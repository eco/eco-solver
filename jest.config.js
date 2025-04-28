/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prettier/prettier */
process.env.MONGOMS_VERSION = '4.0.3';
process.env.MONGOMS_DISABLE_POSTINSTALL = '1';
process.env.MONGOMS_DOWNLOAD_DIR = '~/.cache/mongodb-binaries';

const { mongodbMemoryServerOptions } = require('./jest-mongodb-config.js');

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  preset: '@shelf/jest-mongodb',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>//$1',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/../tsconfig.json',
    },
    mongodbMemoryServerOptions, // 👈 Inject manually here!
  },
  setupFiles: ['<rootDir>/../jest.setup.js'],
}
