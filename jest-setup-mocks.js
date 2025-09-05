// Global mocks for ES modules that cause issues with Jest
// These will be applied to all tests unless overridden by jest.mock() in individual test files

// Only mock if not already mocked in the test file
if (!global.__OCTOKIT_MOCKED__) {
  jest.mock('@octokit/auth-app', () => ({
    createAppAuth: jest.fn(() => {
      return jest.fn(() => ({
        type: 'token',
        token: 'mock-github-token-ghs_1234567890abcdef',
        tokenType: 'installation',
      }))
    }),
  }))

  jest.mock('@octokit/core', () => ({
    Octokit: jest.fn().mockImplementation(() => ({
      request: jest.fn().mockResolvedValue({ data: {} }),
    })),
  }))

  global.__OCTOKIT_MOCKED__ = true
}
