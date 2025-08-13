const { getJestProjects } = require('@nx/jest');

module.exports = {
  projects: getJestProjects(),
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globalSetup: '<rootDir>/jest-mongodb-config.js',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.(t|j)s',
    '!src/**/*.test.(t|j)s',
    '!src/**/index.(t|j)s',
  ],
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.(test|spec)\\.ts$',
  moduleNameMapping: {
    '^@eco-solver/(.*)$': '<rootDir>/libs/$1/src/index.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};