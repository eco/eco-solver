/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prettier/prettier */
const path = require('path')
const os = require('os')

process.env.MONGOMS_VERSION = '6.0.9'
process.env.MONGOMS_DISABLE_POSTINSTALL = '1'
process.env.MONGOMS_DOWNLOAD_DIR = path.join(os.homedir(), '.cache/mongodb-binaries')

const { mongodbMemoryServerOptions } = require('./jest-mongodb-config.js')

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  preset: '@shelf/jest-mongodb',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t)s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../tsconfig.json',
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  watchman: false, // ✅ disables Watchman and uses node-based file crawling
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>//$1',
  },
  globals: {
    mongodbMemoryServerOptions, // 👈 Inject manually here!
  },
  setupFiles: ['<rootDir>/../jest.setup.js', '<rootDir>/../jest-setup-mocks.js'],
}
