import { GitService } from '../git.service';
import * as childProcess from 'child_process';

jest.mock('child_process');

describe('GitService', () => {
  let gitService: GitService;
  const mockExecSync = childProcess.execSync as jest.MockedFunction<
    typeof childProcess.execSync
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    gitService = new GitService({ excludePattern: '(NO-TASK)' });
  });

  describe('getTicketsFromRepositories', () => {
    it('should extract ticket numbers from commit messages', () => {
      const mockCommits = `abc123|||Author One|||DMAP-1234 Fix login issue
def456|||Author Two|||DMAP-1235 Update user profile
ghi789|||Author Three|||Update dependencies (NO-TASK)`;

      mockExecSync.mockImplementation(() => mockCommits);

      const result = gitService.getTicketsFromRepositories(
        ['/path/to/repo'],
        ['v1.0.0'],
        ['v1.1.0']
      );

      expect(result.ticketNumbers).toEqual(['DMAP-1234', 'DMAP-1235']);
      expect(result.commits).toHaveLength(3);
      // The (NO-TASK) commit is excluded entirely, not counted as "without tickets"
      expect(result.commitsWithoutTickets).toHaveLength(0);
    });

    it('should exclude commits matching exclude pattern', () => {
      const mockCommits = `abc123|||Author One|||DMAP-1234 Fix issue
def456|||Author Two|||Update README (NO-TASK)
ghi789|||Author Three|||DMAP-1235 Add feature`;

      mockExecSync.mockImplementation(() => mockCommits);

      const result = gitService.getTicketsFromRepositories(
        ['/path/to/repo'],
        ['v1.0.0'],
        ['v1.1.0']
      );

      expect(result.ticketNumbers).toEqual(['DMAP-1234', 'DMAP-1235']);
      expect(result.commitsWithoutTickets).toHaveLength(0);
    });

    it('should handle multiple repositories', () => {
      const mockCommits1 = 'abc123|||Author One|||DMAP-1234 Fix issue';
      const mockCommits2 = 'def456|||Author Two|||DMAP-1235 Add feature';

      mockExecSync
        .mockImplementationOnce(() => mockCommits1)
        .mockImplementationOnce(() => mockCommits2);

      const result = gitService.getTicketsFromRepositories(
        ['/path/to/repo1', '/path/to/repo2'],
        ['v1.0.0', 'v1.0.0'],
        ['v1.1.0', 'v1.1.0']
      );

      expect(result.ticketNumbers).toEqual(['DMAP-1234', 'DMAP-1235']);
      expect(result.commits).toHaveLength(2);
    });

    it('should deduplicate ticket numbers', () => {
      const mockCommits = `abc123|||Author One|||DMAP-1234 Fix issue
def456|||Author Two|||DMAP-1234 Fix issue again
ghi789|||Author Three|||DMAP-1235 Add feature`;

      mockExecSync.mockImplementation(() => mockCommits);

      const result = gitService.getTicketsFromRepositories(
        ['/path/to/repo'],
        ['v1.0.0'],
        ['v1.1.0']
      );

      expect(result.ticketNumbers).toEqual(['DMAP-1234', 'DMAP-1235']);
    });

    it('should extract multiple tickets from single commit', () => {
      const mockCommits =
        'abc123|||Author One|||DMAP-1234 DMAP-1235 Fix multiple issues';

      mockExecSync.mockImplementation(() => mockCommits);

      const result = gitService.getTicketsFromRepositories(
        ['/path/to/repo'],
        ['v1.0.0'],
        ['v1.1.0']
      );

      expect(result.ticketNumbers).toEqual(['DMAP-1234', 'DMAP-1235']);
    });

    it('should parse commit details correctly', () => {
      const mockCommits = `abc1234567890|||John Doe|||DMAP-1234 Fix login issue`;

      mockExecSync.mockImplementation(() => mockCommits);

      const result = gitService.getTicketsFromRepositories(
        ['/path/to/repo'],
        ['v1.0.0'],
        ['v1.1.0']
      );

      expect(result.commits[0]).toMatchObject({
        hash: 'abc1234567890',
        author: 'John Doe',
        firstLine: 'DMAP-1234 Fix login issue',
        repository: 'repo',
      });
    });

    it('should handle empty commit log', () => {
      mockExecSync.mockImplementation(() => '');

      const result = gitService.getTicketsFromRepositories(
        ['/path/to/repo'],
        ['v1.0.0'],
        ['v1.1.0']
      );

      expect(result.ticketNumbers).toEqual([]);
      expect(result.commits).toHaveLength(0);
      expect(result.commitsWithoutTickets).toHaveLength(0);
    });
  });
});
