import dotenv from 'dotenv';
import minimist from 'minimist';
import { join } from 'path';
import { CliArguments } from '../types';

export class ConfigService {
  public readonly JIRA_API_DOMAIN: string;
  public readonly JIRA_API_EMAIL: string;
  public readonly JIRA_API_TOKEN: string;
  public readonly REPOSITORIES: string[];
  public readonly FROM: string[];
  public readonly TO: string[];
  public readonly FIX_VERSION: string;
  public readonly INCLUDE_SUBTASKS: boolean;
  public readonly LOG_URLS: boolean;
  public readonly LOG_TICKETS: boolean;
  public readonly LOG_SUMMARIES: boolean;
  public readonly LOG_COMMITS: boolean;
  public readonly LOG_AUTHORS: boolean;
  public readonly EXCLUDE_PATTERN: string;

  constructor() {
    // Load environment variables from .env file
    dotenv.config({ path: join(__dirname, '../../.env'), quiet: true });

    const DEFAULT_ARGS = {
      includeSubtasks: false,
      logUrls: true,
      logTickets: false,
      logSummaries: false,
      logCommits: false,
      logAuthors: false,
      excludePattern: '(NO-TASK)',
    };

    const argv = minimist(process.argv.slice(2), {
      string: ['fixVersion', 'from', 'to', 'excludePattern'],
      boolean: true,
    });

    const typedArgv = argv as Partial<CliArguments>;

    if (!typedArgv.from) {
      throw new Error(
        'Please specify the starting version/tag/branch by passing "--from" argument.'
      );
    }

    if (!typedArgv.to) {
      throw new Error(
        'Please specify the ending version/tag/branch by passing "--to" argument.'
      );
    }

    if (!typedArgv.fixVersion) {
      throw new Error(
        'Please specify the fixVersion to check by passing "--fixVersion" argument.'
      );
    }

    this.JIRA_API_DOMAIN = process.env.JIRA_API_DOMAIN || '';
    this.JIRA_API_EMAIL = process.env.JIRA_API_EMAIL || '';
    this.JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';
    this.REPOSITORIES = this.getRepositories();
    this.FROM = this.parseVersionArg(typedArgv.from!);
    this.TO = this.parseVersionArg(typedArgv.to!);

    // Validate that if multiple values are provided, they match repository count
    if (this.FROM.length > 1 && this.FROM.length !== this.REPOSITORIES.length) {
      throw new Error(
        `Number of --from values (${this.FROM.length}) must match number of repositories (${this.REPOSITORIES.length}) or be a single value.`
      );
    }

    if (this.TO.length > 1 && this.TO.length !== this.REPOSITORIES.length) {
      throw new Error(
        `Number of --to values (${this.TO.length}) must match number of repositories (${this.REPOSITORIES.length}) or be a single value.`
      );
    }

    this.FIX_VERSION = typedArgv.fixVersion!;
    this.INCLUDE_SUBTASKS =
      typedArgv.includeSubtasks ?? DEFAULT_ARGS.includeSubtasks;
    this.LOG_URLS = typedArgv.logUrls ?? DEFAULT_ARGS.logUrls;
    this.LOG_TICKETS = typedArgv.logTickets ?? DEFAULT_ARGS.logTickets;
    this.LOG_SUMMARIES = typedArgv.logSummaries ?? DEFAULT_ARGS.logSummaries;
    this.LOG_COMMITS = typedArgv.logCommits ?? DEFAULT_ARGS.logCommits;
    this.LOG_AUTHORS = typedArgv.logAuthors ?? DEFAULT_ARGS.logAuthors;
    this.EXCLUDE_PATTERN =
      typedArgv.excludePattern || DEFAULT_ARGS.excludePattern;
  }

  private getRepositories(): string[] {
    const envPaths = process.env.PATHS_TO_PROJECTS || '';
    if (!envPaths) {
      throw new Error(
        'Please specify at least one repository path via PATHS_TO_PROJECTS env var.'
      );
    }
    return envPaths
      .split(',')
      .map((r: string) => r.trim())
      .filter(Boolean);
  }

  private parseVersionArg(arg: string): string[] {
    return arg
      .split(',')
      .map((v: string) => v.trim())
      .filter(Boolean);
  }
}
