export interface CliArguments {
  logUrls: boolean;
  logTickets: boolean;
  logSummaries: boolean;
  logCommits: boolean;
  logAuthors: boolean;
  includeSubtasks: boolean;
  fixVersion: string;
  excludePattern: string;
  from: string;
  to: string;
}
