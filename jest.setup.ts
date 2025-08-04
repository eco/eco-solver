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