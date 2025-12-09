// Mock dotenv before any imports
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// Mock minimist
jest.mock('minimist', () => {
  return jest.fn(() => ({
    from: '6.14.1,6.14.0',
    to: 'main',
    fixVersion: '6.15',
    logTickets: true,
    logUrls: true,
    excludePattern: '(NO-TASK)',
  }));
});

describe('ConfigService', () => {
  let ConfigService: any;

  beforeAll(() => {
    // Set environment variables before importing ConfigService
    process.env.JIRA_API_DOMAIN = 'test-domain';
    process.env.JIRA_API_EMAIL = 'test@example.com';
    process.env.JIRA_API_TOKEN = 'test-token';
    process.env.PATHS_TO_PROJECTS = '/path/to/project1,/path/to/project2';

    // Import ConfigService after environment is set
    ConfigService = require('../config.service').ConfigService;
  });

  it('should export JIRA environment variables', () => {
    const config = new ConfigService();
    expect(config.JIRA_API_DOMAIN).toBe('test-domain');
    expect(config.JIRA_API_EMAIL).toBe('test@example.com');
    expect(config.JIRA_API_TOKEN).toBe('test-token');
  });

  it('should parse repositories from environment', () => {
    const config = new ConfigService();
    expect(config.REPOSITORIES).toHaveLength(2);
    expect(config.REPOSITORIES[0]).toBe('/path/to/project1');
    expect(config.REPOSITORIES[1]).toBe('/path/to/project2');
  });

  it('should parse from values', () => {
    const config = new ConfigService();
    expect(config.FROM).toHaveLength(2);
    expect(config.FROM[0]).toBe('6.14.1');
    expect(config.FROM[1]).toBe('6.14.0');
  });

  it('should parse to values', () => {
    const config = new ConfigService();
    expect(config.TO).toHaveLength(1);
    expect(config.TO[0]).toBe('main');
  });

  it('should parse process arguments', () => {
    const config = new ConfigService();
    expect(config.FIX_VERSION).toBe('6.15');
    expect(config.LOG_TICKETS).toBe(true);
    expect(config.LOG_URLS).toBe(true);
  });

  it('should use default values for optional arguments', () => {
    const config = new ConfigService();
    expect(config.EXCLUDE_PATTERN).toBe('(NO-TASK)');
  });
});
