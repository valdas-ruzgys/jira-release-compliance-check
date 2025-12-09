// Mock ConfigService to avoid requiring command line arguments
jest.mock('../config.service', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    JIRA_API_DOMAIN: 'test-domain',
    JIRA_API_EMAIL: 'test@example.com',
    JIRA_API_TOKEN: 'test-token',
    REPOSITORIES: ['/test'],
    FROM: ['v1.0.0'],
    TO: ['v1.1.0'],
    FIX_VERSION: '1.0.0',
    LOG_URLS: true,
    LOG_TICKETS: false,
    LOG_SUMMARIES: false,
    LOG_COMMITS: false,
    LOG_AUTHORS: false,
    INCLUDE_SUBTASKS: false,
    EXCLUDE_PATTERN: '(NO-TASK)',
  })),
}));

import { JiraService } from '../jira.service';
import { JiraIssue } from '../../types';

// Mock node-fetch
jest.mock('node-fetch', () => jest.fn());
import fetch from 'node-fetch';
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('JiraService', () => {
  let jiraService: JiraService;

  beforeEach(() => {
    jest.clearAllMocks();
    jiraService = new JiraService({ includeSubtasks: false });
  });

  describe('getFilteredTicketData', () => {
    it('should filter and process regular tickets', () => {
      const mockIssues: JiraIssue[] = [
        {
          key: 'DMAP-1234',
          fields: {
            summary: 'Fix login issue',
            issuetype: { subtask: false, name: 'Story' },
            fixVersions: [{ name: '6.15' }],
            parent: undefined,
          },
        },
      ];

      const result = jiraService.getFilteredTicketData(mockIssues);

      expect(result['DMAP-1234']).toMatchObject({
        summary: 'Fix login issue',
        issueType: 'Story',
        fixVersions: ['6.15'],
        subtasks: [],
      });
    });

    it('should handle tickets without fixVersions', () => {
      const mockIssues: JiraIssue[] = [
        {
          key: 'DMAP-1234',
          fields: {
            summary: 'Fix issue',
            issuetype: { subtask: false, name: 'Bug' },
            fixVersions: [],
            parent: null as any,
          },
        },
      ];

      const result = jiraService.getFilteredTicketData(mockIssues);

      expect(result['DMAP-1234'].fixVersions).toEqual([]);
    });

    it('should handle parent-subtask relationships', () => {
      // Use service with includeSubtasks enabled for this test
      const jiraServiceWithSubtasks = new JiraService({
        includeSubtasks: true,
      });

      const mockIssues: JiraIssue[] = [
        {
          key: 'DMAP-1234',
          fields: {
            summary: 'Parent Story',
            issuetype: { subtask: false, name: 'Story' },
            fixVersions: [{ name: '6.15' }],
            parent: null as any,
          },
        },
        {
          key: 'DMAP-1234-1',
          fields: {
            summary: 'Subtask',
            issuetype: { subtask: true, name: 'Subtask' },
            fixVersions: [{ name: '6.15' }],
            parent: {
              key: 'DMAP-1234',
              fields: {
                summary: 'Parent Story',
                issuetype: { subtask: false, name: 'Story' },
                fixVersions: [],
                parent: null as any,
              },
            },
          },
        },
      ];

      const result = jiraServiceWithSubtasks.getFilteredTicketData(mockIssues);

      expect(result['DMAP-1234'].subtasks).toHaveLength(1);
      expect(result['DMAP-1234'].subtasks[0].key).toBe('DMAP-1234-1');
    });

    it('should create parent entry from subtask when parent not in list', () => {
      // Use service with includeSubtasks enabled for this test
      const jiraServiceWithSubtasks = new JiraService({
        includeSubtasks: true,
      });

      const mockIssues: JiraIssue[] = [
        {
          key: 'DMAP-1234-1',
          fields: {
            summary: 'Subtask',
            issuetype: { subtask: true, name: 'Subtask' },
            fixVersions: [{ name: '6.15' }],
            parent: {
              key: 'DMAP-1234',
              fields: {
                summary: 'Parent Story',
                issuetype: { name: 'Story', subtask: false },
                fixVersions: [{ name: '6.15' }],
                parent: undefined,
              },
            },
          },
        },
      ];

      const result = jiraServiceWithSubtasks.getFilteredTicketData(mockIssues);

      expect(result['DMAP-1234']).toBeDefined();
      expect(result['DMAP-1234'].summary).toBe('Parent Story');
      expect(result['DMAP-1234'].subtasks).toHaveLength(1);
    });
  });

  describe('categorizeTasks', () => {
    it('should categorize found and missing tasks', () => {
      const allTasks: JiraIssue[] = [
        {
          key: 'DMAP-1234',
          fields: {
            summary: 'Task 1',
            issuetype: { name: 'Story', subtask: false },
            fixVersions: [{ name: '6.15' }],
            parent: undefined,
          },
        },
        {
          key: 'DMAP-1235',
          fields: {
            summary: 'Task 2',
            issuetype: { name: 'Story', subtask: false },
            fixVersions: [{ name: '6.15' }],
            parent: undefined,
          },
        },
      ];

      const ticketsInCommits: JiraIssue[] = [allTasks[0]];

      const result = jiraService['categorizeTasks'](allTasks, ticketsInCommits);

      expect(result.foundTasks).toHaveLength(1);
      expect(result.foundTasks[0].key).toBe('DMAP-1234');
      expect(result.missingTasks).toHaveLength(1);
      expect(result.missingTasks[0].key).toBe('DMAP-1235');
    });

    it('should mark parent as found if subtask is in commits', () => {
      const parentTask: JiraIssue = {
        key: 'DMAP-1234',
        fields: {
          summary: 'Parent',
          issuetype: { name: 'Story', subtask: false },
          fixVersions: [{ name: '6.15' }],
          parent: undefined,
        },
      };

      const subtask: JiraIssue = {
        key: 'DMAP-1234-1',
        fields: {
          summary: 'Subtask',
          issuetype: { name: 'Subtask', subtask: true },
          fixVersions: [{ name: '6.15' }],
          parent: {
            key: 'DMAP-1234',
            fields: {
              fixVersions: [{ name: '6.14' }],
              issuetype: { name: 'Story', subtask: false },
              summary: '',
            },
          },
        },
      };

      const allTasks = [parentTask, subtask];
      const ticketsInCommits = [subtask];

      const result = jiraService['categorizeTasks'](allTasks, ticketsInCommits);

      expect(result.foundTasks.map((t) => t.key)).toContain('DMAP-1234');
      expect(result.missingTasks).toHaveLength(0);
    });

    it('should mark subtask as found if parent is in commits', () => {
      const parentTask: JiraIssue = {
        key: 'DMAP-1234',
        fields: {
          summary: 'Parent',
          issuetype: { name: 'Story', subtask: false },
          fixVersions: [{ name: '6.15' }],
          parent: undefined,
        },
      };

      const subtask: JiraIssue = {
        key: 'DMAP-1234-1',
        fields: {
          summary: 'Subtask',
          issuetype: { name: 'Subtask', subtask: true },
          fixVersions: [{ name: '6.15' }],
          parent: {
            key: 'DMAP-1234',
            fields: {
              summary: 'Parent',
              fixVersions: [{ name: '6.15' }],
              issuetype: { name: 'Story', subtask: false },
            },
          },
        },
      };

      const allTasks = [parentTask, subtask];
      const ticketsInCommits = [parentTask];

      const result = jiraService['categorizeTasks'](allTasks, ticketsInCommits);

      expect(result.foundTasks.map((t) => t.key)).toContain('DMAP-1234');
      expect(result.missingTasks).toHaveLength(0);
    });
  });

  describe('fetchAndProcessTickets', () => {
    it('should fetch tickets and return processed data', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          issues: [
            {
              key: 'DMAP-1234',
              fields: {
                summary: 'Test issue',
                issuetype: { name: 'Story', subtask: false },
                fixVersions: [{ name: '6.15' }],
                parent: undefined,
                subtasks: [],
              },
            },
          ],
          isLast: true,
          nextPageToken: undefined,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await jiraService.fetchAndProcessTickets(['DMAP-1234']);

      expect(result.rawTickets).toHaveLength(1);
      expect(result.ticketsData).toHaveLength(1);
      expect(result.ticketsData[0][0]).toBe('DMAP-1234');
    });

    it('should handle pagination', async () => {
      const mockResponse1 = {
        ok: true,
        json: async () => ({
          issues: [
            {
              key: 'DMAP-1234',
              fields: {
                summary: 'Issue 1',
                issuetype: { name: 'Story', subtask: false },
                fixVersions: [],
                parent: undefined,
                subtasks: [],
              },
            },
          ],
          isLast: false,
          nextPageToken: 'token123',
        }),
      };

      const mockResponse2 = {
        ok: true,
        json: async () => ({
          issues: [
            {
              key: 'DMAP-1235',
              fields: {
                summary: 'Issue 2',
                issuetype: { name: 'Story', subtask: false },
                fixVersions: [],
                parent: undefined,
                subtasks: [],
              },
            },
          ],
          isLast: true,
          nextPageToken: undefined,
        }),
      };

      mockFetch
        .mockResolvedValueOnce(mockResponse1 as any)
        .mockResolvedValueOnce(mockResponse2 as any);

      const result = await jiraService.fetchAndProcessTickets([
        'DMAP-1234',
        'DMAP-1235',
      ]);

      expect(result.rawTickets).toHaveLength(2);
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        jiraService.fetchAndProcessTickets(['DMAP-1234'])
      ).rejects.toThrow();
    });
  });
});
