const dotenv = require('dotenv');
const path = require('path');

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Suppress console logs during tests unless explicitly needed
if (process.env.NODE_ENV === 'test' && !process.env.SHOW_TEST_LOGS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Mock problematic modules that have issues in test environment
// Only mock if not already mocked in the test file
if (!jest.isMockFunction(require('@zerodev/sdk').createKernelAccount)) {
  jest.mock('@zerodev/sdk', () => ({
    createKernelAccount: jest.fn().mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      isDeployed: jest.fn().mockResolvedValue(true),
      getFactoryArgs: jest.fn().mockResolvedValue({ factory: null, factoryData: null }),
    }),
  }));
}

jest.mock('@zerodev/sdk/constants', () => ({
  getEntryPoint: jest.fn(() => '0x0000000071727De22E5E9d8BAf0edAc6f37da032'),
  KERNEL_V3_1: '0.3.1',
}));

jest.mock('@zerodev/ecdsa-validator', () => ({
  signerToEcdsaValidator: jest.fn().mockResolvedValue({
    getAddress: jest.fn().mockResolvedValue('0x1234567890123456789012345678901234567890'),
  }),
}));