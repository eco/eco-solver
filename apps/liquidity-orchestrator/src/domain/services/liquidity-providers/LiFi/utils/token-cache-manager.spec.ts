// Mock the LiFi SDK
jest.mock('@lifi/sdk', () => ({
  getTokens: jest.fn(),
  getChains: jest.fn(),
  ChainType: {
    EVM: 'EVM',
    SVM: 'SVM',
  },
}))

describe('LiFiAssetCacheManager', () => {
  let cacheManager: LiFiAssetCacheManager
  let ecoConfigService: DeepMocked<EcoConfigService>
  let logger: DeepMocked<Logger>
  let mockGetTokens: jest.MockedFunction<typeof LiFiSDK.getTokens>
  let mockGetChains: jest.MockedFunction<typeof LiFiSDK.getChains>

  const mockTokensResponse = {
    tokens: {
      '1': [
        {
          address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          symbol: 'USDC',
          decimals: 6,
          chainId: 1,
          name: 'USD Coin',
          logoURI: 'https://example.com/usdc.png',
          priceUSD: '1.00',
        },
        {
          address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          symbol: 'USDT',
          decimals: 6,
          chainId: 1,
          name: 'Tether USD',
          logoURI: 'https://example.com/usdt.png',
          priceUSD: '1.00',
        },
      ],
      '137': [
        {
          address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          symbol: 'USDC',
          decimals: 6,
          chainId: 137,
          name: 'USD Coin (PoS)',
          logoURI: 'https://example.com/usdc-polygon.png',
          priceUSD: '1.00',
        },
      ],
    },
  }

  const mockChainsResponse = [
    {
      id: 1,
      key: 'eth',
      name: 'Ethereum',
      chainType: 'EVM',
      coin: 'ETH',
      mainnet: true,
      metamask: {
        chainId: '0x1',
        blockExplorerUrls: ['https://etherscan.io'],
        chainName: 'Ethereum Mainnet',
        nativeCurrency: {
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
        },
        rpcUrls: ['https://mainnet.infura.io/v3/'],
      },
      nativeToken: {
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        decimals: 18,
        chainId: 1,
        name: 'Ethereum',
        logoURI: 'https://example.com/eth.png',
        priceUSD: '2000.00',
      },
    },
    {
      id: 137,
      key: 'pol',
      name: 'Polygon',
      chainType: 'EVM',
      coin: 'MATIC',
      mainnet: true,
      metamask: {
        chainId: '0x89',
        blockExplorerUrls: ['https://polygonscan.com'],
        chainName: 'Polygon Mainnet',
        nativeCurrency: {
          name: 'Polygon',
          symbol: 'MATIC',
          decimals: 18,
        },
        rpcUrls: ['https://polygon-rpc.com/'],
      },
      nativeToken: {
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'MATIC',
        decimals: 18,
        chainId: 137,
        name: 'Polygon',
        logoURI: 'https://example.com/matic.png',
        priceUSD: '0.80',
      },
    },
  ] as any[] // Type cast to avoid complex ExtendedChain interface issues in tests

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EcoConfigService,
          useValue: createMock<EcoConfigService>(),
        },
      ],
    }).compile()

    ecoConfigService = module.get(EcoConfigService)
    logger = createMock<Logger>()

    mockGetTokens = LiFiSDK.getTokens as jest.MockedFunction<typeof LiFiSDK.getTokens>
    mockGetChains = LiFiSDK.getChains as jest.MockedFunction<typeof LiFiSDK.getChains>

    // Reset mocks
    mockGetTokens.mockReset()
    mockGetChains.mockReset()

    // Default successful responses
    mockGetTokens.mockResolvedValue(mockTokensResponse)
    mockGetChains.mockResolvedValue(mockChainsResponse)

    cacheManager = new LiFiAssetCacheManager(ecoConfigService, logger)
  })

  afterEach(() => {
    cacheManager.destroy()
    jest.clearAllTimers()
  })

  describe('Initialization', () => {
    it('should initialize successfully with valid data', async () => {
      await cacheManager.initialize()

      const status = cacheManager.getCacheStatus()
      expect(status.isInitialized).toBe(true)
      expect(status.isValid).toBe(true)
      expect(status.totalChains).toBe(2)
      expect(status.totalTokens).toBe(3)

      expect(mockGetTokens).toHaveBeenCalledTimes(1)
      expect(mockGetChains).toHaveBeenCalledWith({ chainTypes: ['EVM'] })
      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'LiFi: Asset cache initialized successfully',
        }),
      )
    })

    it('should be idempotent - multiple calls should not refetch', async () => {
      await cacheManager.initialize()
      await cacheManager.initialize()
      await cacheManager.initialize()

      expect(mockGetTokens).toHaveBeenCalledTimes(1)
      expect(mockGetChains).toHaveBeenCalledTimes(1)
    })

    it('should handle API failures during initialization', async () => {
      const error = new Error('LiFi API Error')
      mockGetTokens.mockRejectedValue(error)

      await expect(cacheManager.initialize()).rejects.toThrow('LiFi API Error')

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'LiFi: Failed to initialize asset cache',
        }),
      )
    })

    it('should retry on failure with exponential backoff', async () => {
      mockGetTokens
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockTokensResponse)

      await cacheManager.initialize()

      expect(mockGetTokens).toHaveBeenCalledTimes(3)
      expect(logger.warn).toHaveBeenCalledTimes(2)
    })

    it('should skip initialization when disabled', async () => {
      cacheManager = new LiFiAssetCacheManager(ecoConfigService, logger, { enabled: false })

      await cacheManager.initialize()

      expect(mockGetTokens).not.toHaveBeenCalled()
      expect(mockGetChains).not.toHaveBeenCalled()
      expect(logger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'LiFi: Asset cache disabled by configuration',
        }),
      )
    })
  })

  describe('Token Validation', () => {
    beforeEach(async () => {
      await cacheManager.initialize()
    })

    it('should validate supported tokens correctly', () => {
      // Test Ethereum USDC
      expect(cacheManager.isTokenSupported(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(
        true,
      )

      // Test Polygon USDC
      expect(cacheManager.isTokenSupported(137, '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174')).toBe(
        true,
      )

      // Test Ethereum USDT
      expect(cacheManager.isTokenSupported(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe(
        true,
      )
    })

    it('should reject unsupported tokens', () => {
      // Unsupported token on supported chain
      expect(cacheManager.isTokenSupported(1, '0x1234567890123456789012345678901234567890')).toBe(
        false,
      )

      // Supported token on unsupported chain
      expect(cacheManager.isTokenSupported(999, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(
        false,
      )

      // Unsupported token on unsupported chain
      expect(cacheManager.isTokenSupported(999, '0x1234567890123456789012345678901234567890')).toBe(
        false,
      )
    })

    it('should handle case-insensitive address comparison', () => {
      // Test uppercase address
      expect(cacheManager.isTokenSupported(1, '0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48')).toBe(
        true,
      )

      // Test mixed case address
      expect(cacheManager.isTokenSupported(1, '0xA0b86991C6218b36c1D19d4a2e9eB0cE3606eB48')).toBe(
        true,
      )
    })

    it('should use fallback behavior when cache not ready', () => {
      const uninitializedManager = new LiFiAssetCacheManager(ecoConfigService, logger, {
        fallbackBehavior: 'allow-all',
      })

      expect(
        uninitializedManager.isTokenSupported(1, '0x1234567890123456789012345678901234567890'),
      ).toBe(true)

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'LiFi: Asset cache not ready, allowing token by default',
        }),
      )
    })

    it('should deny tokens when fallback is deny-unknown', () => {
      const uninitializedManager = new LiFiAssetCacheManager(ecoConfigService, logger, {
        fallbackBehavior: 'deny-unknown',
      })

      expect(
        uninitializedManager.isTokenSupported(1, '0x1234567890123456789012345678901234567890'),
      ).toBe(false)

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'LiFi: Asset cache not ready, denying token by default',
        }),
      )
    })
  })

  describe('Chain Validation', () => {
    beforeEach(async () => {
      await cacheManager.initialize()
    })

    it('should validate supported chains correctly', () => {
      expect(cacheManager.isChainSupported(1)).toBe(true) // Ethereum
      expect(cacheManager.isChainSupported(137)).toBe(true) // Polygon
    })

    it('should reject unsupported chains', () => {
      expect(cacheManager.isChainSupported(999)).toBe(false)
      expect(cacheManager.isChainSupported(56)).toBe(false) // BSC not in mock data
    })

    it('should return supported chains list', () => {
      const chains = cacheManager.getSupportedChains()
      expect(chains).toHaveLength(2)
      expect(chains.map((c) => c.id)).toEqual([1, 137])
      expect(chains.map((c) => c.name)).toEqual(['Ethereum', 'Polygon'])
    })
  })

  describe('Cache Refresh', () => {
    beforeEach(async () => {
      await cacheManager.initialize()
    })

    it('should refresh cache manually', async () => {
      // Clear call counts from initialization
      mockGetTokens.mockClear()
      mockGetChains.mockClear()

      await cacheManager.refreshCache()

      expect(mockGetTokens).toHaveBeenCalledTimes(1)
      expect(mockGetChains).toHaveBeenCalledTimes(1)
    })

    it('should handle refresh failures gracefully', async () => {
      const error = new Error('Refresh failed')
      mockGetTokens.mockRejectedValue(error)

      await expect(cacheManager.refreshCache()).rejects.toThrow('Refresh failed')

      expect(logger.warn).toHaveBeenCalled()
    })

    it('should setup automatic refresh timer', async () => {
      jest.useFakeTimers()

      const shortRefreshManager = new LiFiAssetCacheManager(ecoConfigService, logger, {
        refreshInterval: 100, // 100ms for testing
      })

      await shortRefreshManager.initialize()

      // Verify timer was set up by checking debug logs
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'LiFi: Cache refresh timer scheduled',
        }),
      )

      shortRefreshManager.destroy()
      jest.useRealTimers()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty token lists', async () => {
      mockGetTokens.mockResolvedValue({ tokens: {} })

      await cacheManager.initialize()

      const status = cacheManager.getCacheStatus()
      expect(status.totalTokens).toBe(0)
      expect(status.totalChains).toBe(2) // Chains should still be loaded
    })

    it('should handle empty chain lists', async () => {
      mockGetChains.mockResolvedValue([])

      await cacheManager.initialize()

      const status = cacheManager.getCacheStatus()
      expect(status.totalChains).toBe(0)
      expect(status.totalTokens).toBe(3) // Tokens should still be loaded
    })

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout')
      timeoutError.name = 'TimeoutError'
      mockGetTokens.mockRejectedValue(timeoutError)

      await expect(cacheManager.initialize()).rejects.toThrow('Network timeout')
    })

    it('should handle invalid API responses', async () => {
      mockGetTokens.mockResolvedValue(null as any)

      await expect(cacheManager.initialize()).rejects.toThrow()
    })

    it('should handle malformed token data', async () => {
      const malformedResponse = {
        tokens: {
          '1': [
            {
              // Missing required fields
              symbol: 'INVALID',
            },
          ],
        },
      }

      mockGetTokens.mockResolvedValue(malformedResponse as any)

      await expect(cacheManager.initialize()).rejects.toThrow()
    })
  })

  describe('Cache Status', () => {
    beforeEach(async () => {
      await cacheManager.initialize()
    })

    it('should provide accurate cache status', () => {
      const status = cacheManager.getCacheStatus()

      expect(status.isInitialized).toBe(true)
      expect(status.isValid).toBe(true)
      expect(status.totalChains).toBe(2)
      expect(status.totalTokens).toBe(3)
      expect(status.lastUpdated).toBeInstanceOf(Date)
      expect(status.nextRefresh).toBeInstanceOf(Date)
      expect(status.cacheAge).toBeGreaterThanOrEqual(0)
    })

    it('should detect expired cache', () => {
      const shortTTLManager = new LiFiAssetCacheManager(ecoConfigService, logger, {
        ttl: 0, // Immediately expired
      })

      // Manually set cache as if it was initialized in the past
      shortTTLManager['cache'].metadata.lastUpdated = new Date(Date.now() - 1000)
      shortTTLManager['isInitialized'] = true

      const status = shortTTLManager.getCacheStatus()
      expect(status.isValid).toBe(false)

      shortTTLManager.destroy()
    })
  })

  describe('Token Connections', () => {
    beforeEach(async () => {
      await cacheManager.initialize()
    })

    it('should validate token connections', () => {
      // Both tokens supported
      expect(
        cacheManager.areTokensConnected(
          1,
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // ETH USDC
          137,
          '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon USDC
        ),
      ).toBe(true)

      // One token unsupported
      expect(
        cacheManager.areTokensConnected(
          1,
          '0x1234567890123456789012345678901234567890', // Unsupported
          137,
          '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon USDC
        ),
      ).toBe(false)
    })
  })

  describe('Utility Methods', () => {
    beforeEach(async () => {
      await cacheManager.initialize()
    })

    it('should get supported tokens for chain', () => {
      const ethTokens = cacheManager.getSupportedTokensForChain(1)
      expect(ethTokens).toBeInstanceOf(Set)
      expect(ethTokens?.size).toBe(2)
      expect(ethTokens?.has('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')).toBe(true) // lowercase

      const polygonTokens = cacheManager.getSupportedTokensForChain(137)
      expect(polygonTokens?.size).toBe(1)

      const unsupportedChainTokens = cacheManager.getSupportedTokensForChain(999)
      expect(unsupportedChainTokens).toBeUndefined()
    })
  })

  describe('Cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      // Initialize first to create a timer
      await cacheManager.initialize()

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval')

      cacheManager.destroy()

      expect(clearIntervalSpy).toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: 'LiFi: Asset cache manager destroyed',
        }),
      )
    })
  })
})
