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
            repositories: [{ full_name: 'fake-org/fake-config-repo' }],
          },
        })
      }

      // Mock file content requests for individual files (more specific URLs)
      if (url.includes('config1.json') || url.includes('config2.json')) {
        let configData
        if (url.includes('config1.json')) {
          configData = {
            setting1: 'value1',
            nested: { prop1: 'value1', shared: 'from-config1' },
            array: [1, 2],
          }
        } else {
          configData = {
            setting2: 'value2',
            nested: { prop2: 'value2', shared: 'from-config2' },
            array: [3, 4],
          }
        }

        return Promise.resolve({
          data: {
            type: 'file',
            content: Buffer.from(JSON.stringify(configData)).toString('base64'),
          },
        })
      }

      // Mock directory contents request (URLs ending with the directory path)
      if (url.includes('contents/assets/preprod') && !url.includes('.json')) {
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
        repo: 'fake-org/fake-config-repo',
        hash: 'fake1234567890abcdef1234567890abcdef12345678',
        env: 'preprod',
      }
    }
    if (key === 'gitApp') {
      return {
        appId: 'fake-app-id-123',
        privateKey:
          '-----BEGIN RSA PRIVATE KEY-----\nFAKE_PRIVATE_KEY_FOR_TESTING_ONLY\n-----END RSA PRIVATE KEY-----',
        installationId: 'fake-installation-id-456',
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
      const originalMock = jest.spyOn(require('config'), 'get')
      originalMock.mockReturnValue(undefined)

      await service.initConfigs()

      expect(service.getConfig()).toEqual({})

      // Restore the original mock implementation
      originalMock.mockRestore()
    })

    it('should work with GitHub App authentication', async () => {
      // Should not throw an error when initializing with GitHub App authentication
      await expect(service.initConfigs()).resolves.toBeUndefined()

      const result = service.getConfig()
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })

    it('should recursively merge JSON config files', async () => {
      // Ensure proper config mock for this test
      jest.spyOn(require('config'), 'get').mockImplementation((key) => {
        if (key === 'gitConfig') {
          return {
            repo: 'fake-org/fake-config-repo',
            hash: 'fake1234567890abcdef1234567890abcdef12345678',
            env: 'preprod',
          }
        }
        if (key === 'gitApp') {
          return {
            appId: 'fake-app-id-123',
            privateKey:
              '-----BEGIN RSA PRIVATE KEY-----\nFAKE_PRIVATE_KEY_FOR_TESTING_ONLY\n-----END RSA PRIVATE KEY-----',
            installationId: 'fake-installation-id-456',
          }
        }
        return null
      })

      // Create a fresh instance for this test
      const module: TestingModule = await Test.createTestingModule({
        providers: [GitHubConfigService],
      }).compile()
      const testService = module.get<GitHubConfigService>(GitHubConfigService)

      await testService.initConfigs()

      const result = testService.getConfig()

      // Should have properties from both config files
      expect(result.setting1).toBe('value1')
      expect(result.setting2).toBe('value2')

      // Should deep merge nested objects
      expect(result.nested).toEqual({
        prop1: 'value1',
        prop2: 'value2',
        shared: 'from-config2', // Last config wins for conflicting keys
      })

      // Should merge arrays (lodash merge replaces arrays, last wins)
      expect(result.array).toEqual([3, 4])
    })
  })
})
