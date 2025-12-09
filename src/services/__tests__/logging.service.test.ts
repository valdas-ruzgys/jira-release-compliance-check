import { LoggingService } from '../logging.service';
import { IssueData, JiraIssue } from '../../types';
import { ParsedCommit } from '../git.service';

describe('LoggingService', () => {
  let loggingService: LoggingService;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    loggingService = new LoggingService({
      logCommits: false,
      logAuthors: false,
      logTicketKeys: true,
      logSummaries: true,
      logUrls: true,
      apiDomain: 'test-domain',
    });
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('logHeader', () => {
    it('should log header with title', () => {
      loggingService.logHeader();

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      const headerCall = calls.find((call) =>
        call.includes('JIRA Release Compliance Check')
      );
      expect(headerCall).toBeDefined();
    });
  });

  describe('logVersionRanges', () => {
    it('should log version ranges for repositories', () => {
      loggingService.logVersionRanges(
        ['/path/to/repo1', '/path/to/repo2'],
        ['6.14.1', '6.14.0'],
        ['main', 'main']
      );

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((call) => call.includes('repo1'))).toBe(true);
      expect(calls.some((call) => call.includes('6.14.1'))).toBe(true);
    });

    it('should handle single version for multiple repositories', () => {
      loggingService.logVersionRanges(
        ['/path/to/repo1', '/path/to/repo2'],
        ['6.14.1'],
        ['main']
      );

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('logSummary', () => {
    it('should log summary with ticket and commit counts', () => {
      loggingService.logSummary(58, 124);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((call) => call.includes('58'))).toBe(true);
      expect(calls.some((call) => call.includes('124'))).toBe(true);
    });
  });

  describe('logTickets', () => {
    it('should log ticket data with correct format', () => {
      const ticketsData: [string, IssueData][] = [
        [
          'DMAP-1234',
          {
            summary: 'Fix login issue',
            issueType: 'Story',
            fixVersions: ['6.15'],
            subtasks: [],
          },
        ],
      ];

      loggingService.logTickets('Test Header', ticketsData);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((call) => call.includes('DMAP-1234'))).toBe(true);
      expect(calls.some((call) => call.includes('Fix login issue'))).toBe(true);
    });

    it('should log subtasks when present', () => {
      const ticketsData: [string, IssueData][] = [
        [
          'DMAP-1234',
          {
            summary: 'Parent task',
            issueType: 'Story',
            fixVersions: ['6.15'],
            subtasks: [
              {
                key: 'DMAP-1234-1',
                summary: 'Subtask',
              },
            ],
          },
        ],
      ];

      loggingService.logTickets('Test Header', ticketsData);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((call) => call.includes('DMAP-1234-1'))).toBe(true);
    });
  });

  describe('logTicketsWithError', () => {
    it('should highlight higher versions in red', () => {
      const ticketsData: [string, IssueData][] = [
        [
          'DMAP-1234',
          {
            summary: 'Future feature',
            issueType: 'Story',
            fixVersions: ['6.16'],
            subtasks: [],
          },
        ],
      ];

      loggingService.logTicketsWithError(
        '❌ ERROR: 1 task(s) with HIGHER version',
        ticketsData,
        '6.15'
      );

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should not highlight lower versions', () => {
      const ticketsData: [string, IssueData][] = [
        [
          'DMAP-1234',
          {
            summary: 'Old feature',
            issueType: 'Story',
            fixVersions: ['6.14'],
            subtasks: [],
          },
        ],
      ];

      loggingService.logTicketsWithError(
        '⚠️ WARNING: non-matching versions',
        ticketsData,
        '6.15'
      );

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('logFixVersionCheckResults', () => {
    it('should log found and missing tasks', () => {
      const foundTasks: JiraIssue[] = [
        {
          key: 'DMAP-1234',
          fields: {
            summary: 'Found task',
            issuetype: { name: 'Story', subtask: false },
            fixVersions: [{ name: '6.15' }],
            parent: undefined,
          },
        },
      ];

      const missingTasks: JiraIssue[] = [
        {
          key: 'DMAP-1235',
          fields: {
            summary: 'Missing task',
            issuetype: { name: 'Story', subtask: false },
            fixVersions: [{ name: '6.15' }],
            parent: undefined,
          },
        },
      ];

      const missingTicketsData: [string, IssueData][] = [
        [
          'DMAP-1235',
          {
            summary: 'Missing task',
            issueType: 'Story',
            fixVersions: ['6.15'],
            subtasks: [],
          },
        ],
      ];

      loggingService.logFixVersionCheckResults(
        '6.15',
        foundTasks,
        missingTasks,
        missingTicketsData
      );

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((call) => call.includes('6.15'))).toBe(true);
    });

    it('should show success message when no missing tasks', () => {
      const foundTasks: JiraIssue[] = [
        {
          key: 'DMAP-1234',
          fields: {
            summary: 'Found task',
            issuetype: { name: 'Story', subtask: false },
            fixVersions: [{ name: '6.15' }],
            parent: undefined,
          },
        },
      ];

      loggingService.logFixVersionCheckResults('6.15', foundTasks, [], []);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((call) => call.includes('All tasks'))).toBe(true);
    });
  });

  describe('logCommitsWithoutTickets', () => {
    it('should log commits without tickets when present', () => {
      const commits: ParsedCommit[] = [
        {
          hash: 'abc123',
          author: 'John Doe',
          firstLine: 'Update dependencies',
          message: 'Update dependencies\n\nNo ticket reference here.',
          repository: 'repo1',
        },
      ];

      loggingService.logCommitsWithoutTickets(commits);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((call) => call.includes('abc123'))).toBe(true);
    });

    it('should not log when no commits without tickets', () => {
      loggingService.logCommitsWithoutTickets([]);

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('logComplete', () => {
    it('should log completion message', () => {
      loggingService.logComplete();

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((call) => call.includes('Complete'))).toBe(true);
    });
  });
});
