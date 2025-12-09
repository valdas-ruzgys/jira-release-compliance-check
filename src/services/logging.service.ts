import chalk from 'chalk';
import semver from 'semver';
import { IssueData, JiraIssue } from '../types';
import { ParsedCommit } from './git.service';

// Color helpers
const colors = {
  header: chalk.bold.cyan,
  success: chalk.green,
  warning: chalk.yellow,
  error: chalk.red,
  info: chalk.blue,
  dim: chalk.dim,
  hash: chalk.gray,
  ticket: chalk.bold.blue,
  version: chalk.green,
};

export interface LoggingServiceOptions {
  logCommits: boolean;
  logAuthors: boolean;
  logTicketKeys: boolean;
  logSummaries: boolean;
  logUrls: boolean;
  apiDomain: string;
}

export class LoggingService {
  constructor(private options: LoggingServiceOptions) {}

  logHeader(): void {
    console.log('\n' + '='.repeat(80));
    console.log(colors.header('🔍 JIRA Release Compliance Check'));
    console.log('='.repeat(80));
  }

  private formatVersionRange(repo: string, from: string, to: string): string {
    const repoName = repo.split('/').pop() || repo;
    return colors.dim(
      `  → ${repoName}: ${colors.version(from)} → ${colors.version(to)}`
    );
  }

  logVersionRanges(
    repositories: string[],
    fromValues: string[],
    toValues: string[]
  ): void {
    console.log(colors.info('📍 Version ranges per repository:'));
    repositories.forEach((repo, index) => {
      const from = fromValues.length > 1 ? fromValues[index] : fromValues[0];
      const to = toValues.length > 1 ? toValues[index] : toValues[0];
      console.log(this.formatVersionRange(repo, from, to));
    });
    console.log('='.repeat(80) + '\n');
  }

  logSummary(ticketCount: number, commitCount: number): void {
    console.log(
      colors.success(
        `✓ Found ${colors.ticket(
          ticketCount.toString()
        )} unique ticket(s) in ${commitCount} commit(s)\n`
      )
    );
  }

  private formatCommitLine(
    commit: ParsedCommit,
    includeAuthor: boolean = false
  ): string {
    const hashStr = colors.hash(commit.hash.substring(0, 7));
    const repoStr = colors.dim('[' + commit.repository + ']');
    const authorStr =
      includeAuthor && this.options.logAuthors && commit.author
        ? colors.dim(` (${commit.author})`)
        : '';
    return `  ${hashStr}  ${repoStr}  ${commit.firstLine}${authorStr}`;
  }

  logAllCommits(commits: ParsedCommit[]): void {
    if (this.options.logCommits) {
      console.log(colors.info('\n📝 All commits:'));
      console.log(colors.dim('-'.repeat(80)));
      commits.forEach((commit) => {
        console.log(this.formatCommitLine(commit));
      });
      console.log('');
    }
  }

  logCommitsWithoutTickets(commits: ParsedCommit[]): void {
    if (commits.length > 0) {
      console.log(
        colors.warning(
          `\n⚠️  WARNING: ${commits.length} commit(s) without ticket numbers`
        )
      );
      console.log(colors.dim('-'.repeat(80)));
      commits.forEach((commit) => {
        console.log(this.formatCommitLine(commit, true));
      });
      console.log('');
    }
  }

  private formatHeader(
    header: string,
    type: 'warning' | 'error' | 'info'
  ): string {
    switch (type) {
      case 'error':
        return colors.error(header);
      case 'warning':
        return colors.warning(header);
      default:
        return colors.header(header);
    }
  }

  logTickets(header: string, ticketsData: [string, IssueData][]): void {
    const isWarning = header.includes('WARNING');
    console.log(this.formatHeader(header, isWarning ? 'warning' : 'info'));
    console.log(colors.dim('-'.repeat(80)));

    const columnWidths = this.calculateColumnWidths(ticketsData);

    ticketsData.forEach(([key, value]) => {
      this.logTicketLine(key, value, columnWidths);
      this.logSubtasks(value.subtasks);
    });
    console.log('');
  }

  logTicketsWithError(
    header: string,
    ticketsData: [string, IssueData][],
    expectedVersion: string
  ): void {
    const isError = header.includes('ERROR');
    const isWarning = header.includes('WARNING');
    const headerType = isError ? 'error' : isWarning ? 'warning' : 'info';

    console.log(this.formatHeader(header, headerType));
    console.log(colors.dim('-'.repeat(80)));

    const columnWidths = this.calculateColumnWidths(ticketsData);

    ticketsData.forEach(([key, value]) => {
      this.logTicketLineWithErrorVersion(
        key,
        value,
        columnWidths,
        expectedVersion
      );
      this.logSubtasks(value.subtasks);
    });
    console.log('');
  }

  private calculateColumnWidths(ticketsData: [string, IssueData][]): {
    issueType: number;
    key: number;
  } {
    const getMaxLength = (data: string[]) =>
      Math.max(...data.map((x) => x.length));

    return {
      issueType: getMaxLength(
        ticketsData.map(([, { issueType }]) => issueType)
      ),
      key: getMaxLength(ticketsData.map(([key]) => key)),
    };
  }

  private ensureLength(str: string, length: number): string {
    return str.length >= length ? str : str + ' '.repeat(length - str.length);
  }

  private formatTicketLine(
    key: string,
    value: IssueData,
    columnWidths: { issueType: number; key: number }
  ): string {
    const versionStr = value.fixVersions.length
      ? colors.version(value.fixVersions.join(', '))
      : colors.dim('----');

    const issueTypeStr =
      colors.dim(`[${value.issueType}]`) +
      ' '.repeat(Math.max(0, columnWidths.issueType - value.issueType.length));
    const keyStr = this.options.logTicketKeys
      ? colors.ticket(this.ensureLength(key, columnWidths.key))
      : '';
    const summaryStr = this.options.logSummaries ? value.summary : '';
    const urlStr = this.options.logUrls
      ? colors.dim(
          ` https://${this.options.apiDomain}.atlassian.net/browse/${key}`
        )
      : '';

    const logParts = [versionStr, issueTypeStr, keyStr, summaryStr, urlStr];
    return '  ' + logParts.filter(Boolean).join(' ');
  }

  private logTicketLine(
    key: string,
    value: IssueData,
    columnWidths: { issueType: number; key: number }
  ): void {
    console.log(this.formatTicketLine(key, value, columnWidths));
  }

  private formatTicketLineWithErrorVersion(
    key: string,
    value: IssueData,
    columnWidths: { issueType: number; key: number },
    expectedVersion: string
  ): string {
    const versionStr = value.fixVersions.length
      ? value.fixVersions
          .map((v) => {
            const compare = this.compareVersions(v, expectedVersion);
            return compare > 0 ? colors.error(v) : colors.version(v);
          })
          .join(', ')
      : colors.dim('----');

    const issueTypeStr =
      colors.dim(`[${value.issueType}]`) +
      ' '.repeat(Math.max(0, columnWidths.issueType - value.issueType.length));
    const keyStr = this.options.logTicketKeys
      ? colors.ticket(this.ensureLength(key, columnWidths.key))
      : '';
    const summaryStr = this.options.logSummaries ? value.summary : '';
    const urlStr = this.options.logUrls
      ? colors.dim(
          ` https://${this.options.apiDomain}.atlassian.net/browse/${key}`
        )
      : '';

    const logParts = [versionStr, issueTypeStr, keyStr, summaryStr, urlStr];
    return '  ' + logParts.filter(Boolean).join(' ');
  }

  private logTicketLineWithErrorVersion(
    key: string,
    value: IssueData,
    columnWidths: { issueType: number; key: number },
    expectedVersion: string
  ): void {
    console.log(
      this.formatTicketLineWithErrorVersion(
        key,
        value,
        columnWidths,
        expectedVersion
      )
    );
  }

  private compareVersions(version1: string, version2: string): number {
    const v1 = semver.coerce(version1);
    const v2 = semver.coerce(version2);

    if (!v1 || !v2) {
      // Fallback to string comparison if semver coerce fails
      return version1.localeCompare(version2);
    }

    return semver.compare(v1, v2);
  }

  private formatSubtaskLine(subtask: IssueData['subtasks'][0]): string {
    const subtaskParts = [
      colors.dim('  →'),
      this.options.logTicketKeys ? colors.dim(subtask.key) : '',
      colors.dim('[Subtask]'),
      this.options.logSummaries ? colors.dim(subtask.summary) : '',
    ];
    return '  ' + subtaskParts.filter(Boolean).join(' ');
  }

  private logSubtasks(subtasks: IssueData['subtasks']): void {
    subtasks.forEach((subtask) => {
      console.log(this.formatSubtaskLine(subtask));
    });
  }

  logFixVersionCheckHeader(fixVersion: string): void {
    console.log(
      colors.header(
        `\n🔍 Checking fixVersion compliance: ${colors.version(fixVersion)}`
      )
    );
    console.log(colors.dim('-'.repeat(80)));
  }

  logFixVersionCheckResults(
    fixVersion: string,
    foundTasks: JiraIssue[],
    missingTasks: JiraIssue[],
    missingTicketsData: [string, IssueData][]
  ): void {
    const total = foundTasks.length + missingTasks.length;
    console.log(
      colors.info(`  Total tasks with fixVersion "${fixVersion}": ${total}`)
    );
    console.log(colors.success(`  ✓ Found in commits: ${foundTasks.length}`));

    if (missingTasks.length > 0) {
      console.log(
        colors.error(`  ✗ Missing from commits: ${missingTasks.length}\n`)
      );

      this.logTickets(
        colors.warning(
          `⚠️  WARNING: ${missingTasks.length} task(s) with fixVersion "${fixVersion}" are NOT in commits`
        ),
        missingTicketsData
      );
    } else {
      console.log(
        colors.success(
          `  ✓ All tasks with fixVersion "${fixVersion}" are included in commits\n`
        )
      );
    }
  }

  logComplete(): void {
    console.log('\n' + '='.repeat(80));
    console.log(colors.success('✓ Complete'));
    console.log('='.repeat(80) + '\n');
  }
}
