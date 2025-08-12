import { Test, TestingModule } from '@nestjs/testing'
import { GitHubConfigService } from '../github-config.service'

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
    it('should download and merge configs from multiple git sources', async () => {
      const mockGitConfigs = [
        {
          repo: 'eco-incorp/config-eco-solver',
          hash: '7e596cf30b5163b18e393828dd6287df812b7674',
          env: 'preprod',
          token: 'test-token',
        },
      ]

      const mockDirectoryContents = [
        {
          name: 'config1.json',
          type: 'file',
          download_url:
            'https://raw.githubusercontent.com/eco-incorp/config-eco-solver/7e596cf30b5163b18e393828dd6287df812b7674/assets/preprod/config1.json',
        },
        {
          name: 'config2.json',
          type: 'file',
          download_url:
            'https://raw.githubusercontent.com/eco-incorp/config-eco-solver/7e596cf30b5163b18e393828dd6287df812b7674/assets/preprod/config2.json',
        },
      ]

      const mockConfig1 = { setting1: 'value1' }
      const mockConfig2 = { setting2: 'value2' }

      jest.spyOn(require('config'), 'get').mockReturnValue(mockGitConfigs)

      // Mock directory contents API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDirectoryContents),
      } as Response)

      // Mock individual file downloads
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig1),
      } as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig2),
      } as Response)

      await service.initConfigs()

      expect(service.getConfig()).toEqual({
        setting1: 'value1',
        setting2: 'value2',
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/eco-incorp/config-eco-solver/contents/assets/preprod?ref=7e596cf30b5163b18e393828dd6287df812b7674',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      )
    })

    it('should recursively merge complex nested configs with arrays from multiple sources', async () => {
      const mockGitConfigs = [
        {
          repo: 'eco-incorp/config-eco-solver',
          hash: 'hash1',
          env: 'preprod',
        },
        {
          repo: 'eco-incorp/config-eco-solver-2',
          hash: 'hash2',
          env: 'preprod',
        },
      ]

      // First repo directory contents
      const mockDirectoryContents1 = [
        {
          name: 'chains.json',
          type: 'file',
          download_url: 'https://example.com/chains1.json',
        },
        {
          name: 'configs.json',
          type: 'file',
          download_url: 'https://example.com/configs1.json',
        },
      ]

      // Second repo directory contents
      const mockDirectoryContents2 = [
        {
          name: 'chains.json',
          type: 'file',
          download_url: 'https://example.com/chains2.json',
        },
        {
          name: 'whitelist.json',
          type: 'file',
          download_url: 'https://example.com/whitelist2.json',
        },
      ]

      // First repo configs - similar to your real data structure
      const mockChainsConfig1 = {
        chains: {
          intentSources: [
            {
              network: 'eth-mainnet',
              chainID: 1,
              config: { ecoRoutes: 'replace' },
              tokens: [
                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                '0xdac17f958d2ee523a2206206994597c13d831ec7',
              ],
            },
            {
              network: 'opt-mainnet',
              chainID: 10,
              config: { ecoRoutes: 'replace' },
              tokens: ['0x0b2c639c533813f4aa9d7837caf62653d097ff85'],
            },
          ],
          solvers: {
            '1': {
              targets: {
                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
                  contractType: 'erc20',
                  selectors: ['transfer(address,uint256)'],
                  minBalance: 75,
                },
              },
              network: 'eth-mainnet',
              chainID: 1,
            },
          },
        },
      }

      const mockGeneralConfig1 = {
        configs: {
          eth: {
            simpleAccount: {
              walletAddr: '0x1F5ef4727F3A5E6AeFbB6745583Ae363B32F8Aaa',
              minEthBalanceWei: 50000000000000000,
            },
          },
          fulfillment: {
            run: 'single',
            type: 'crowd-liquidity',
          },
        },
      }

      // Second repo configs - additional data to merge
      const mockChainsConfig2 = {
        chains: {
          intentSources: [
            {
              network: 'polygon-mainnet',
              chainID: 137,
              config: { ecoRoutes: 'replace' },
              tokens: [
                '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
                '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
              ],
            },
            {
              network: 'base-mainnet',
              chainID: 8453,
              config: { ecoRoutes: 'replace' },
              tokens: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'],
            },
          ],
          solvers: {
            '137': {
              targets: {
                '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359': {
                  contractType: 'erc20',
                  selectors: ['transfer(address,uint256)'],
                  minBalance: 25,
                },
              },
              network: 'polygon-mainnet',
              chainID: 137,
            },
            '1': {
              targets: {
                '0xdac17f958d2ee523a2206206994597c13d831ec7': {
                  contractType: 'erc20',
                  selectors: ['transfer(address,uint256)'],
                  minBalance: 75,
                },
              },
            },
          },
        },
      }

      const mockWhitelistConfig2 = {
        whitelist: {
          whitelist: {
            '0xA94790F67F89CC2D47e00aFBf10716ae7713b943': {
              default: {
                limitFillBase6: 65000000000,
              },
            },
          },
        },
      }

      jest.spyOn(require('config'), 'get').mockReturnValue(mockGitConfigs)

      // Mock all the API calls in sequence
      // First repo directory listing
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDirectoryContents1),
      } as Response)

      // First repo file downloads
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChainsConfig1),
      } as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeneralConfig1),
      } as Response)

      // Second repo directory listing
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDirectoryContents2),
      } as Response)

      // Second repo file downloads
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockChainsConfig2),
      } as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWhitelistConfig2),
      } as Response)

      await service.initConfigs()

      const result = service.getConfig()
      console.log('DEBUG RESULT:', JSON.stringify(result, null, 2))

      // Verify deep merge happened correctly
      expect(result.chains?.intentSources).toHaveLength(4) // 2 from each source
      expect(result.chains.intentSources[0].network).toBe('eth-mainnet')
      expect(result.chains.intentSources[1].network).toBe('opt-mainnet')
      expect(result.chains.intentSources[2].network).toBe('polygon-mainnet')
      expect(result.chains.intentSources[3].network).toBe('base-mainnet')

      // Verify nested object merge for solvers
      expect(result.chains.solvers['1'].targets).toEqual({
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 75,
        },
        '0xdac17f958d2ee523a2206206994597c13d831ec7': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 75,
        },
      })

      expect(result.chains.solvers['137']).toBeDefined()
      expect(result.configs.eth.simpleAccount.walletAddr).toBe(
        '0x1F5ef4727F3A5E6AeFbB6745583Ae363B32F8Aaa',
      )
      expect(result.whitelist.whitelist['0xA94790F67F89CC2D47e00aFBf10716ae7713b943']).toBeDefined()
    })

    it('should handle missing git configs gracefully', async () => {
      jest.spyOn(require('config'), 'get').mockReturnValue([])

      await service.initConfigs()

      expect(service.getConfig()).toEqual({})
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should handle API errors gracefully', async () => {
      const mockGitConfigs = [
        {
          repo: 'eco-incorp/config-eco-solver',
          hash: '7e596cf30b5163b18e393828dd6287df812b7674',
          env: 'preprod',
          token: 'test-token',
        },
      ]

      jest.spyOn(require('config'), 'get').mockReturnValue(mockGitConfigs)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await service.initConfigs()

      expect(service.getConfig()).toEqual({})
    })

    it('should work without authentication token', async () => {
      const mockGitConfigs = [
        {
          repo: 'eco-incorp/config-eco-solver',
          hash: '7e596cf30b5163b18e393828dd6287df812b7674',
          env: 'preprod',
        },
      ]

      const mockDirectoryContents = [
        {
          name: 'config.json',
          type: 'file',
          download_url:
            'https://raw.githubusercontent.com/eco-incorp/config-eco-solver/7e596cf30b5163b18e393828dd6287df812b7674/assets/preprod/config.json',
        },
      ]

      const mockConfig = { setting: 'value' }

      jest.spyOn(require('config'), 'get').mockReturnValue(mockGitConfigs)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDirectoryContents),
      } as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as Response)

      await service.initConfigs()

      expect(service.getConfig()).toEqual(mockConfig)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/eco-incorp/config-eco-solver/contents/assets/preprod?ref=7e596cf30b5163b18e393828dd6287df812b7674',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        }),
      )
    })

    it('should filter non-JSON files', async () => {
      const mockGitConfigs = [
        {
          repo: 'eco-incorp/config-eco-solver',
          hash: '7e596cf30b5163b18e393828dd6287df812b7674',
          env: 'preprod',
        },
      ]

      const mockDirectoryContents = [
        {
          name: 'config.json',
          type: 'file',
          download_url: 'https://example.com/config.json',
        },
        {
          name: 'readme.md',
          type: 'file',
          download_url: 'https://example.com/readme.md',
        },
        {
          name: 'subfolder',
          type: 'dir',
        },
      ]

      const mockConfig = { setting: 'value' }

      jest.spyOn(require('config'), 'get').mockReturnValue(mockGitConfigs)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockDirectoryContents),
      } as Response)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      } as Response)

      await service.initConfigs()

      expect(service.getConfig()).toEqual(mockConfig)
      expect(mockFetch).toHaveBeenCalledTimes(2) // Only directory listing and one JSON file
    })
  })
})
