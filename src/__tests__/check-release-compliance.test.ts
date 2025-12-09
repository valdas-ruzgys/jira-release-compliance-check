// Mock all services before imports
jest.mock('semver');
jest.mock('../services/config.service', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    JIRA_API_DOMAIN: 'test-domain',
    JIRA_API_EMAIL: 'test@example.com',
    JIRA_API_TOKEN: 'test-token',
    REPOSITORIES: ['/test/repo1', '/test/repo2'],
    FROM: ['v1.0.0', 'v1.0.1'],
    TO: ['v1.1.0', 'v1.1.1'],
    FIX_VERSION: '6.15',
    LOG_URLS: true,
    LOG_TICKETS: true,
    LOG_SUMMARIES: true,
    LOG_COMMITS: true,
    LOG_AUTHORS: true,
    INCLUDE_SUBTASKS: true,
    EXCLUDE_PATTERN: '(NO-TASK)',
  })),
}));

jest.mock('../services/git.service');
jest.mock('../services/jira.service');
jest.mock('../services/logging.service');

import semver from 'semver';
import { GitService } from '../services/git.service';
import { JiraService } from '../services/jira.service';
import { LoggingService } from '../services/logging.service';
import { ReleaseComplianceChecker } from '../check-release-compliance';
import { IssueData, JiraIssue } from '../types';

const mockSemver = semver as jest.Mocked<typeof semver>;
const MockedGitService = GitService as jest.MockedClass<typeof GitService>;
const MockedJiraService = JiraService as jest.MockedClass<typeof JiraService>;
const MockedLoggingService = LoggingService as jest.MockedClass<
  typeof LoggingService
>;

describe('ReleaseComplianceChecker', () => {
  let mockGitService: jest.Mocked<GitService>;
  let mockJiraService: jest.Mocked<JiraService>;
  let mockLoggingService: jest.Mocked<LoggingService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock service instances
    mockGitService = {
      getTicketsFromRepositories: jest.fn().mockReturnValue({
        ticketNumbers: [],
        commits: [],
        commitsWithoutTickets: [],
      }),
    } as any;

    mockJiraService = {
      fetchAndProcessTickets: jest.fn(),
      checkFixVersionCompliance: jest.fn(),
      getFilteredTicketData: jest.fn(),
    } as any;

    mockLoggingService = {
      logHeader: jest.fn(),
      logVersionRanges: jest.fn(),
      logSummary: jest.fn(),
      logAllCommits: jest.fn(),
      logCommitsWithoutTickets: jest.fn(),
      logFixVersionCheckHeader: jest.fn(),
      logFixVersionCheckResults: jest.fn(),
      logTicketsWithError: jest.fn(),
      logComplete: jest.fn(),
    } as any;

    // Set up constructor mocks to return our mock instances
    MockedGitService.mockImplementation(() => mockGitService);
    MockedJiraService.mockImplementation(() => mockJiraService);
    MockedLoggingService.mockImplementation(() => mockLoggingService);

    // Mock semver functions
    mockSemver.coerce = jest.fn((version: string) => {
      if (version === 'main' || version === 'invalid') return null;
      return { version } as any;
    });
    mockSemver.gt = jest.fn((v1: any, v2: any) => {
      return parseFloat(v1.version) > parseFloat(v2.version);
    });
  });

  describe('Full workflow', () => {
    it('should execute complete release compliance check workflow', async () => {
      // Setup mock data
      const mockCommits = [
        {
          hash: 'abc123',
          message: 'DMAP-1234 Fix login issue',
          firstLine: 'DMAP-1234 Fix login issue',
          repository: 'repo1',
          author: 'John Doe',
        },
        {
          hash: 'def456',
          message: 'DMAP-1235 Add feature',
          firstLine: 'DMAP-1235 Add feature',
          repository: 'repo2',
          author: 'Jane Smith',
        },
      ];

      const mockTicketsData: [string, IssueData][] = [
        [
          'DMAP-1234',
          {
            summary: 'Fix login issue',
            issueType: 'Story',
            fixVersions: ['6.15'],
            subtasks: [],
          },
        ],
        [
          'DMAP-1235',
          {
            summary: 'Add feature',
            issueType: 'Story',
            fixVersions: ['6.15'],
            subtasks: [],
          },
        ],
      ];

      const mockRawTickets: JiraIssue[] = [
        {
          key: 'DMAP-1234',
          fields: {
            summary: 'Fix login issue',
            issuetype: { name: 'Story', subtask: false },
            fixVersions: [{ name: '6.15' }],
            parent: undefined,
          },
        },
        {
          key: 'DMAP-1235',
          fields: {
            summary: 'Add feature',
            issuetype: { name: 'Story', subtask: false },
            fixVersions: [{ name: '6.15' }],
            parent: undefined,
          },
        },
      ];

      // Setup mock return values
      mockGitService.getTicketsFromRepositories.mockReturnValue({
        ticketNumbers: ['DMAP-1234', 'DMAP-1235'],
        commits: mockCommits,
        commitsWithoutTickets: [],
      });

      mockJiraService.fetchAndProcessTickets.mockResolvedValue({
        ticketsData: mockTicketsData,
        rawTickets: mockRawTickets,
      });

      mockJiraService.checkFixVersionCompliance.mockResolvedValue({
        foundTasks: mockRawTickets,
        missingTasks: [],
      });

      mockJiraService.getFilteredTicketData.mockReturnValue({});

      // Execute
      const checker = new ReleaseComplianceChecker();
      await checker.check();

      // Verify workflow order
      expect(mockLoggingService.logHeader).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.logVersionRanges).toHaveBeenCalledWith(
        ['/test/repo1', '/test/repo2'],
        ['v1.0.0', 'v1.0.1'],
        ['v1.1.0', 'v1.1.1']
      );

      expect(mockGitService.getTicketsFromRepositories).toHaveBeenCalledWith(
        ['/test/repo1', '/test/repo2'],
        ['v1.0.0', 'v1.0.1'],
        ['v1.1.0', 'v1.1.1']
      );

      expect(mockLoggingService.logSummary).toHaveBeenCalledWith(2, 2);
      expect(mockLoggingService.logAllCommits).toHaveBeenCalledWith(
        mockCommits
      );
      expect(mockLoggingService.logCommitsWithoutTickets).toHaveBeenCalledWith(
        []
      );

      expect(mockJiraService.fetchAndProcessTickets).toHaveBeenCalledWith([
        'DMAP-1234',
        'DMAP-1235',
      ]);

      expect(mockLoggingService.logFixVersionCheckHeader).toHaveBeenCalledWith(
        '6.15'
      );
      expect(mockJiraService.checkFixVersionCompliance).toHaveBeenCalledWith(
        mockRawTickets,
        '6.15'
      );

      expect(mockLoggingService.logFixVersionCheckResults).toHaveBeenCalledWith(
        '6.15',
        mockRawTickets,
        [],
        []
      );

      expect(mockLoggingService.logComplete).toHaveBeenCalledTimes(1);

      // Should not log errors since all versions match
      expect(mockLoggingService.logTicketsWithError).not.toHaveBeenCalled();
    });

    it('should log commits without tickets', async () => {
      const commitsWithoutTickets = [
        {
          hash: 'xyz789',
          message: 'Update README',
          firstLine: 'Update README',
          repository: 'repo1',
          author: 'John Doe',
        },
      ];

      mockGitService.getTicketsFromRepositories.mockReturnValue({
        ticketNumbers: ['DMAP-1234'],
        commits: [
          {
            hash: 'abc123',
            message: 'DMAP-1234 Fix',
            firstLine: 'DMAP-1234 Fix',
            repository: 'repo1',
            author: 'Jane',
          },
        ],
        commitsWithoutTickets,
      });

      mockJiraService.fetchAndProcessTickets.mockResolvedValue({
        ticketsData: [],
        rawTickets: [],
      });

      mockJiraService.checkFixVersionCompliance.mockResolvedValue({
        foundTasks: [],
        missingTasks: [],
      });

      mockJiraService.getFilteredTicketData.mockReturnValue({});

      const checker = new ReleaseComplianceChecker();
      await checker.check();

      expect(mockLoggingService.logCommitsWithoutTickets).toHaveBeenCalledWith(
        commitsWithoutTickets
      );
    });

    it('should handle tickets with non-matching fixVersions', async () => {
      const mockTicketsData: [string, IssueData][] = [
        [
          'DMAP-1234',
          {
            summary: 'Old feature',
            issueType: 'Story',
            fixVersions: ['6.14'], // Lower version
            subtasks: [],
          },
        ],
        [
          'DMAP-1235',
          {
            summary: 'Future feature',
            issueType: 'Story',
            fixVersions: ['6.16'], // Higher version
            subtasks: [],
          },
        ],
      ];

      mockGitService.getTicketsFromRepositories.mockReturnValue({
        ticketNumbers: ['DMAP-1234', 'DMAP-1235'],
        commits: [],
        commitsWithoutTickets: [],
      });

      mockJiraService.fetchAndProcessTickets.mockResolvedValue({
        ticketsData: mockTicketsData,
        rawTickets: [],
      });

      mockJiraService.checkFixVersionCompliance.mockResolvedValue({
        foundTasks: [],
        missingTasks: [],
      });

      mockJiraService.getFilteredTicketData.mockReturnValue({});

      // Mock semver.gt to return true for 6.16 > 6.15
      mockSemver.gt.mockImplementation((v1: any, v2: any) => {
        return v1.version === '6.16' && v2.version === '6.15';
      });

      const checker = new ReleaseComplianceChecker();
      await checker.check();

      expect(mockLoggingService.logTicketsWithError).toHaveBeenCalledTimes(1);
      const [header, tickets] =
        mockLoggingService.logTicketsWithError.mock.calls[0];

      expect(header).toContain('ERROR');
      expect(header).toContain('2 task(s)');
      expect(header).toContain('1 with HIGHER version');
      expect(tickets).toHaveLength(2);
    });

    it('should show warning when no higher versions exist', async () => {
      const mockTicketsData: [string, IssueData][] = [
        [
          'DMAP-1234',
          {
            summary: 'Old feature',
            issueType: 'Story',
            fixVersions: ['6.14'], // Lower version
            subtasks: [],
          },
        ],
      ];

      mockGitService.getTicketsFromRepositories.mockReturnValue({
        ticketNumbers: ['DMAP-1234'],
        commits: [],
        commitsWithoutTickets: [],
      });

      mockJiraService.fetchAndProcessTickets.mockResolvedValue({
        ticketsData: mockTicketsData,
        rawTickets: [],
      });

      mockJiraService.checkFixVersionCompliance.mockResolvedValue({
        foundTasks: [],
        missingTasks: [],
      });

      mockJiraService.getFilteredTicketData.mockReturnValue({});

      // Mock semver.gt to return false (6.14 is not > 6.15)
      mockSemver.gt.mockReturnValue(false);

      const checker = new ReleaseComplianceChecker();
      await checker.check();

      const [header] = mockLoggingService.logTicketsWithError.mock.calls[0];
      expect(header).toContain('WARNING');
      expect(header).not.toContain('HIGHER version');
    });

    it('should handle non-semver versions using localeCompare', async () => {
      const mockTicketsData: [string, IssueData][] = [
        [
          'DMAP-1234',
          {
            summary: 'Branch feature',
            issueType: 'Story',
            fixVersions: ['main'], // Non-semver
            subtasks: [],
          },
        ],
      ];

      mockGitService.getTicketsFromRepositories.mockReturnValue({
        ticketNumbers: ['DMAP-1234'],
        commits: [],
        commitsWithoutTickets: [],
      });

      mockJiraService.fetchAndProcessTickets.mockResolvedValue({
        ticketsData: mockTicketsData,
        rawTickets: [],
      });

      mockJiraService.checkFixVersionCompliance.mockResolvedValue({
        foundTasks: [],
        missingTasks: [],
      });

      mockJiraService.getFilteredTicketData.mockReturnValue({});

      // Mock semver.coerce to return null for non-semver versions
      mockSemver.coerce.mockReturnValue(null);

      const checker = new ReleaseComplianceChecker();
      await checker.check();

      expect(mockLoggingService.logTicketsWithError).toHaveBeenCalled();
      expect(mockSemver.coerce).toHaveBeenCalledWith('main');
      expect(mockSemver.coerce).toHaveBeenCalledWith('6.15');
    });

    it('should exclude tickets found in fixVersion check from error report', async () => {
      const mockTicketsData: [string, IssueData][] = [
        [
          'DMAP-1234',
          {
            summary: 'Found task',
            issueType: 'Story',
            fixVersions: ['6.14'], // Wrong version but found in fixVersion check
            subtasks: [],
          },
        ],
        [
          'DMAP-1235',
          {
            summary: 'Not found task',
            issueType: 'Story',
            fixVersions: ['6.14'], // Wrong version and not found
            subtasks: [],
          },
        ],
      ];

      const mockRawTickets: JiraIssue[] = [
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

      mockGitService.getTicketsFromRepositories.mockReturnValue({
        ticketNumbers: ['DMAP-1234', 'DMAP-1235'],
        commits: [],
        commitsWithoutTickets: [],
      });

      mockJiraService.fetchAndProcessTickets.mockResolvedValue({
        ticketsData: mockTicketsData,
        rawTickets: mockRawTickets,
      });

      mockJiraService.checkFixVersionCompliance.mockResolvedValue({
        foundTasks: mockRawTickets, // DMAP-1234 is found
        missingTasks: [],
      });

      mockJiraService.getFilteredTicketData.mockReturnValue({});

      const checker = new ReleaseComplianceChecker();
      await checker.check();

      // Should only report DMAP-1235 (not found in fixVersion check)
      const [, tickets] = mockLoggingService.logTicketsWithError.mock.calls[0];
      expect(tickets).toHaveLength(1);
      expect(tickets[0][0]).toBe('DMAP-1235');
    });

    it('should handle missing tasks in fixVersion check', async () => {
      const missingTask: JiraIssue = {
        key: 'DMAP-9999',
        fields: {
          summary: 'Missing task',
          issuetype: { name: 'Story', subtask: false },
          fixVersions: [{ name: '6.15' }],
          parent: undefined,
        },
      };

      const missingTicketsData: [string, IssueData][] = [
        [
          'DMAP-9999',
          {
            summary: 'Missing task',
            issueType: 'Story',
            fixVersions: ['6.15'],
            subtasks: [],
          },
        ],
      ];

      mockGitService.getTicketsFromRepositories.mockReturnValue({
        ticketNumbers: ['DMAP-1234'],
        commits: [],
        commitsWithoutTickets: [],
      });

      mockJiraService.fetchAndProcessTickets.mockResolvedValue({
        ticketsData: [],
        rawTickets: [],
      });

      mockJiraService.checkFixVersionCompliance.mockResolvedValue({
        foundTasks: [],
        missingTasks: [missingTask],
      });

      mockJiraService.getFilteredTicketData.mockReturnValue({
        'DMAP-9999': missingTicketsData[0][1],
      });

      const checker = new ReleaseComplianceChecker();
      await checker.check();

      expect(mockLoggingService.logFixVersionCheckResults).toHaveBeenCalledWith(
        '6.15',
        [],
        [missingTask],
        missingTicketsData
      );
    });

    it('should call all services with correct initialization parameters', async () => {
      mockGitService.getTicketsFromRepositories.mockReturnValue({
        ticketNumbers: [],
        commits: [],
        commitsWithoutTickets: [],
      });

      mockJiraService.fetchAndProcessTickets.mockResolvedValue({
        ticketsData: [],
        rawTickets: [],
      });

      mockJiraService.checkFixVersionCompliance.mockResolvedValue({
        foundTasks: [],
        missingTasks: [],
      });

      mockJiraService.getFilteredTicketData.mockReturnValue({});

      const checker = new ReleaseComplianceChecker();
      await checker.check();

      // Verify services were initialized with correct parameters
      expect(MockedGitService).toHaveBeenCalledWith({
        excludePattern: '(NO-TASK)',
      });
      expect(MockedJiraService).toHaveBeenCalledWith({ includeSubtasks: true });
      expect(MockedLoggingService).toHaveBeenCalledWith({
        logCommits: true,
        logAuthors: true,
        logTicketKeys: true,
        logSummaries: true,
        logUrls: true,
        apiDomain: 'test-domain',
      });
    });
  });
});
