// Jest setup for eco-solver
// This file runs before all tests

// Set test environment
process.env.NODE_ENV = 'test'

// Set default timeouts
jest.setTimeout(30000)

// Mock console methods in test environment
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    // Uncomment to silence logs in tests
    // log: jest.fn(),
    // debug: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
  }
}
