module.exports = jest.fn(() => ({
  from: 'v1.0.0',
  to: 'v1.1.0',
  fixVersion: '1.0.0',
  logUrls: true,
  logTickets: false,
  logSummaries: false,
  logCommits: false,
  logAuthors: false,
  includeSubtasks: false,
  excludePattern: '(NO-TASK)',
}));
