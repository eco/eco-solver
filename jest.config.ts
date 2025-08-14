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
    '^@eco/foundation-eco-adapter$': '<rootDir>/../libs/foundation/eco-adapter/src/index.ts',
    '^@eco/infrastructure-config$': '<rootDir>/../libs/infrastructure/config/src/index.ts',
    '^@eco/infrastructure-logging$': '<rootDir>/../libs/infrastructure/logging/src/index.ts',
    '^@eco/infrastructure-database$': '<rootDir>/../libs/infrastructure/database/src/index.ts',
    '^@eco/infrastructure-redis$': '<rootDir>/../libs/infrastructure/redis/src/index.ts',
    '^@eco/infrastructure-blockchain$': '<rootDir>/../libs/infrastructure/blockchain/src/index.ts',
    '^@eco/infrastructure-external-apis$': '<rootDir>/../libs/infrastructure/external-apis/src/index.ts',
    '^@eco/infrastructure-event-bridge$': '<rootDir>/../libs/infrastructure/event-bridge/src/index.ts',
    '^@eco/domain-intent-core$': '<rootDir>/../libs/domain/intent-core/src/index.ts',
    '^@eco/shared-types$': '<rootDir>/../libs/shared/types/src/index.ts',
    '^@eco/shared-dto$': '<rootDir>/../libs/shared/dto/src/index.ts',
    '^@eco/shared-guards$': '<rootDir>/../libs/shared/guards/src/index.ts',
    '^@eco/shared-pipes$': '<rootDir>/../libs/shared/pipes/src/index.ts',
    '^@eco/shared-interceptors$': '<rootDir>/../libs/shared/interceptors/src/index.ts',
    '^@eco/shared-utils$': '<rootDir>/../libs/shared/utils/src/index.ts',
    '^@eco/utils$': '<rootDir>/../libs/shared/utils/src/index.ts',
  },
  globals: {
    mongodbMemoryServerOptions, // 👈 Inject manually here!
  },
  setupFiles: ['<rootDir>/../jest.setup.js'],
}
