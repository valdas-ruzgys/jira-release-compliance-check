import child_process from 'child_process';

export interface ParsedCommit {
  hash: string;
  message: string;
  firstLine: string;
  repository: string;
  author?: string;
}

const TICKET_REGEX = /[A-Z]{2,10}-[1-9][0-9]*/g;

export interface GitServiceOptions {
  excludePattern: string;
}

export class GitService {
  constructor(private options: GitServiceOptions) {}

  fetchCommits(from: string, to: string, repoPath: string): string {
    // Using custom format with unique separator
    // %H = commit hash, %an = author name, %B = raw body
    return child_process.execSync(
      `git log --pretty=format:"%H|||%an|||%B" --no-merges ${from}...${to}`,
      {
        cwd: repoPath,
        encoding: 'utf-8',
      }
    );
  }

  parseCommits(rawCommits: string, repository: string): ParsedCommit[] {
    if (!rawCommits.trim()) {
      return [];
    }

    const commits: ParsedCommit[] = [];
    const lines = rawCommits.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('|||')) {
        const parts = line.split('|||');
        const hash = parts[0];
        const author = parts[1];
        const messageParts = parts.slice(2);
        const messageLines = [messageParts.join('|||')];

        // Collect subsequent lines until we hit another commit (line with |||) or end
        while (i + 1 < lines.length && !lines[i + 1].includes('|||')) {
          i++;
          messageLines.push(lines[i]);
        }

        const message = messageLines.join('\n').trim();
        const firstLine = messageLines[0]?.trim() || '';

        if (hash && message) {
          commits.push({
            hash: hash.trim(),
            message,
            firstLine,
            repository,
            author: author?.trim(),
          });
        }
      }
    }

    return commits;
  }

  filterFeatureCommits(commits: ParsedCommit[]): ParsedCommit[] {
    return commits.filter(
      (commit) =>
        !commit.firstLine.startsWith('Merged ') &&
        !commit.firstLine.startsWith('Merge branch ') &&
        !commit.firstLine.startsWith('Revert ') &&
        commit.message
    );
  }

  extractTicketNumbers(commits: ParsedCommit[]): {
    ticketNumbers: string[];
    commitsWithoutTickets: ParsedCommit[];
  } {
    const ticketNumbers: string[] = [];
    const commitsWithoutTickets: ParsedCommit[] = [];
    const excludeRegex = new RegExp(this.options.excludePattern, 'i');

    commits.forEach((commit) => {
      // Skip commits that match the exclude pattern
      if (excludeRegex.test(commit.message)) {
        return;
      }

      const matches = commit.message.match(TICKET_REGEX);

      if (matches) {
        // Filter out excluded patterns
        const validMatches = matches.filter(
          (match) => !excludeRegex.test(match)
        );
        if (validMatches.length > 0) {
          ticketNumbers.push(...validMatches);
        } else {
          commitsWithoutTickets.push(commit);
        }
      } else {
        commitsWithoutTickets.push(commit);
      }
    });

    return { ticketNumbers, commitsWithoutTickets };
  }

  getTicketsFromRepositories(
    repositories: string[],
    fromValues: string[],
    toValues: string[]
  ): {
    ticketNumbers: string[];
    commits: ParsedCommit[];
    commitsWithoutTickets: ParsedCommit[];
  } {
    let allCommits: ParsedCommit[] = [];

    repositories.forEach((repoPath, index) => {
      const repoName = repoPath.split('/').pop() || repoPath;
      const from = fromValues.length > 1 ? fromValues[index] : fromValues[0];
      const to = toValues.length > 1 ? toValues[index] : toValues[0];

      const rawCommits = this.fetchCommits(from, to, repoPath);
      const parsedCommits = this.parseCommits(rawCommits, repoName);
      allCommits = allCommits.concat(parsedCommits);
    });

    const featureCommits = this.filterFeatureCommits(allCommits);
    const { ticketNumbers, commitsWithoutTickets } =
      this.extractTicketNumbers(featureCommits);

    return {
      ticketNumbers: Array.from(new Set(ticketNumbers)),
      commits: featureCommits,
      commitsWithoutTickets,
    };
  }
}
