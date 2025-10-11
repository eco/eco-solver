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

// Mock AWS SDK to prevent real AWS calls during tests
if (!global.__AWS_SDK_MOCKED__) {
  jest.mock('@aws-sdk/client-secrets-manager', () => ({
    SecretsManager: jest.fn().mockImplementation(() => ({
      getSecretValue: jest.fn().mockResolvedValue({
        SecretString: JSON.stringify({ mocked: 'secret-data' }),
      }),
    })),
  }))

  jest.mock('@aws-sdk/client-kms', () => ({
    KMSClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({ mocked: 'kms-response' }),
    })),
    EncryptCommand: jest.fn(),
    DecryptCommand: jest.fn(),
  }))

  global.__AWS_SDK_MOCKED__ = true
}
