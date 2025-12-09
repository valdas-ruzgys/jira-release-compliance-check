// Mock ConfigService to avoid requiring command line arguments
jest.mock('../../services/config.service', () => ({
  ConfigService: jest.fn().mockImplementation(() => ({
    JIRA_API_DOMAIN: 'test',
    JIRA_API_EMAIL: 'test@test.com',
    JIRA_API_TOKEN: 'token',
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

import { chunks } from '../fetch-utils';

describe('utils', () => {
  describe('chunks', () => {
    it('should split array into chunks of specified size', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const result = chunks(array, 3);

      expect(result).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);
    });

    it('should handle last chunk being smaller', () => {
      const array = [1, 2, 3, 4, 5];
      const result = chunks(array, 2);

      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle empty array', () => {
      const result = chunks([], 5);
      expect(result).toEqual([]);
    });

    it('should handle chunk size larger than array', () => {
      const array = [1, 2, 3];
      const result = chunks(array, 10);

      expect(result).toEqual([[1, 2, 3]]);
    });

    it('should handle chunk size of 1', () => {
      const array = [1, 2, 3];
      const result = chunks(array, 1);

      expect(result).toEqual([[1], [2], [3]]);
    });

    it('should work with string arrays', () => {
      const array = ['a', 'b', 'c', 'd', 'e'];
      const result = chunks(array, 2);

      expect(result).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    });
  });
});
