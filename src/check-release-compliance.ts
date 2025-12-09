import semver from 'semver';
import {
  GitService,
  JiraService,
  LoggingService,
  ConfigService,
} from './services';

export class ReleaseComplianceChecker {
  private gitService: GitService;
  private jiraService: JiraService;
  private loggingService: LoggingService;
  private config: ConfigService;

  constructor() {
    this.config = new ConfigService();

    this.gitService = new GitService({
      excludePattern: this.config.EXCLUDE_PATTERN,
    });
    this.jiraService = new JiraService({
      includeSubtasks: this.config.INCLUDE_SUBTASKS,
    });
    this.loggingService = new LoggingService({
      logCommits: this.config.LOG_COMMITS,
      logAuthors: this.config.LOG_AUTHORS,
      logTicketKeys: this.config.LOG_TICKETS,
      logSummaries: this.config.LOG_SUMMARIES,
      logUrls: this.config.LOG_URLS,
      apiDomain: this.config.JIRA_API_DOMAIN,
    });
  }

  async check(): Promise<void> {
    const { REPOSITORIES, FROM, TO } = this.config;

    this.loggingService.logHeader();
    this.loggingService.logVersionRanges(REPOSITORIES, FROM, TO);

    const { ticketNumbers, commits, commitsWithoutTickets } =
      this.gitService.getTicketsFromRepositories(REPOSITORIES, FROM, TO);

    this.loggingService.logSummary(ticketNumbers.length, commits.length);
    this.loggingService.logAllCommits(commits);
    this.loggingService.logCommitsWithoutTickets(commitsWithoutTickets);

    const { ticketsData, rawTickets } =
      await this.jiraService.fetchAndProcessTickets(ticketNumbers);

    const foundTaskKeys = await this.handleFixVersionCheck(
      rawTickets,
      this.config.FIX_VERSION
    );

    this.displayTicketResults(
      ticketsData,
      this.config.FIX_VERSION,
      foundTaskKeys
    );

    this.loggingService.logComplete();
  }

  private async handleFixVersionCheck(
    ticketsInCommits: import('./types').JiraIssue[],
    fixVersion: string
  ): Promise<Set<string>> {
    this.loggingService.logFixVersionCheckHeader(fixVersion);

    const { missingTasks, foundTasks } =
      await this.jiraService.checkFixVersionCompliance(
        ticketsInCommits,
        fixVersion
      );

    const missingTicketsData = Object.entries(
      this.jiraService.getFilteredTicketData(missingTasks)
    );

    this.loggingService.logFixVersionCheckResults(
      fixVersion,
      foundTasks,
      missingTasks,
      missingTicketsData
    );

    // Return the keys of found tasks
    return new Set(foundTasks.map((t) => t.key));
  }

  private displayTicketResults(
    ticketsData: [string, import('./types').IssueData][],
    fixVersion: string,
    foundTaskKeys: Set<string>
  ): void {
    const nonMatchingFixVersionTickets = ticketsData.filter(
      ([key, data]) =>
        !data.fixVersions.includes(fixVersion) && !foundTaskKeys?.has(key)
    );

    // Count tickets with higher versions using semver
    const higherVersionCount = nonMatchingFixVersionTickets.filter(([, data]) =>
      data.fixVersions.some((version) => {
        const v1 = semver.coerce(version);
        const v2 = semver.coerce(fixVersion);

        if (!v1 || !v2) {
          return version.localeCompare(fixVersion) > 0;
        }

        return semver.gt(v1, v2);
      })
    ).length;

    // Show all non-matching tickets in a single list with higher versions highlighted in red
    if (nonMatchingFixVersionTickets.length > 0) {
      const header =
        higherVersionCount > 0
          ? `\n❌ ERROR: ${nonMatchingFixVersionTickets.length} task(s) found in commits with non matching fixVersion (${higherVersionCount} with HIGHER version):`
          : `\n⚠️  WARNING: ${nonMatchingFixVersionTickets.length} task(s) found in commits with non matching fixVersion:`;

      this.loggingService.logTicketsWithError(
        header,
        nonMatchingFixVersionTickets,
        fixVersion
      );
    }
  }
}
