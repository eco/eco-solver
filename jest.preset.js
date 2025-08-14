const { nxPreset } = require('@nx/jest/preset');

module.exports = {
  ...nxPreset,
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.(t|j)s',
    '!src/**/*.test.(t|j)s',
    '!src/**/index.(t|j)s',
  ]
};