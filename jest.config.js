module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 80,
      lines: 75,
      statements: 75,
    },
  },
  moduleNameMapper: {
    '^types$': '<rootDir>/src/types',
    '^chalk$': '<rootDir>/src/__tests__/__mocks__/chalk.ts',
    '^node-fetch$': '<rootDir>/src/__tests__/__mocks__/node-fetch.ts',
  },
};
