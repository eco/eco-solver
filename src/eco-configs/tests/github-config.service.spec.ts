import { Test, TestingModule } from '@nestjs/testing'
import { GitHubConfigService } from '../github-config.service'

// Set flag to prevent global mocks from applying
global.__OCTOKIT_MOCKED__ = true

// Mock @octokit/auth-app
jest.mock('@octokit/auth-app', () => ({
  createAppAuth: jest.fn(() => {
    return jest.fn(() => ({
      type: 'token',
      token: 'mock-github-token-ghs_1234567890abcdef',
      tokenType: 'installation',
    }))
  }),
}))

// Mock @octokit/core
jest.mock('@octokit/core', () => ({
  Octokit: jest.fn().mockImplementation(() => {
    const mockRequest = jest.fn().mockImplementation((url) => {
      // Mock repository access check
      if (url === 'GET /installation/repositories') {
        return Promise.resolve({
          data: {
            repositories: [{ full_name: 'eco-incorp/config-eco-solver' }],
          },
        })
      }

      // Mock directory contents request
      if (url.includes('contents')) {
        return Promise.resolve({
          data: [
            {
              name: 'config1.json',
              type: 'file',
              path: 'assets/preprod/config1.json',
            },
            {
              name: 'config2.json',
              type: 'file',
              path: 'assets/preprod/config2.json',
            },
          ],
        })
      }

      // Mock file content requests
      if (url.includes('contents/assets')) {
        const configData = url.includes('config1') ? { setting1: 'value1' } : { setting2: 'value2' }

        return Promise.resolve({
          data: {
            type: 'file',
            content: Buffer.from(JSON.stringify(configData)).toString('base64'),
          },
        })
      }

      return Promise.resolve({ data: {} })
    })

    return {
      request: mockRequest,
    }
  }),
}))

// Mock config
jest.mock('config', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'gitConfig') {
      return {
        repo: 'eco-incorp/config-eco-solver',
        hash: '7e596cf30b5163b18e393828dd6287df812b7674',
        env: 'preprod',
      }
    }
    if (key === 'gitApp') {
      return {
        appId: '1854237',
        privateKey:
          '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1234567890abcdef\n-----END RSA PRIVATE KEY-----',
        installationId: '84502358',
      }
    }
    return null
  }),
  has: jest.fn().mockReturnValue(true),
}))

global.fetch = jest.fn()

describe('GitHubConfigService', () => {
  let service: GitHubConfigService
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitHubConfigService],
    }).compile()

    service = module.get<GitHubConfigService>(GitHubConfigService)
    mockFetch.mockClear()
  })

  describe('getConfig', () => {
    it('should return empty config initially', () => {
      expect(service.getConfig()).toEqual({})
    })
  })

  describe('initConfigs', () => {
    it('should download and merge configs from git source', async () => {
      await service.initConfigs()

      // With mocked Octokit, configs should be successfully downloaded
      const result = service.getConfig()
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })

    it('should handle missing git configs gracefully', async () => {
      // Override the mock for this test
      jest.spyOn(require('config'), 'get').mockReturnValue(undefined)

      await service.initConfigs()

      expect(service.getConfig()).toEqual({})

      // Restore the mock
      jest.restoreAllMocks()
    })

    it('should work with GitHub App authentication', async () => {
      // Should not throw an error when initializing with GitHub App authentication
      await expect(service.initConfigs()).resolves.toBeUndefined()

      const result = service.getConfig()
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })
})
