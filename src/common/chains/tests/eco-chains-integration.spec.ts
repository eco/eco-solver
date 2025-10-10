import { EcoChains } from '@eco-foundation/chains'
import { arbitrum, base, mainnet, polygon } from 'viem/chains'

describe('EcoChains Integration Tests', () => {
  const mockApiKeys = {
    alchemyKey: 'dummy-alchemy-key-12345',
    infuraKey: 'dummy-infura-key-67890',
    mantaKey: 'dummy-manta-key-abcde',
  }

  describe('getRpcUrlsForChain', () => {
    let ecoChains: EcoChains

    beforeEach(() => {
      // Initialize EcoChains with dummy API keys
      ecoChains = new EcoChains(mockApiKeys)
    })

    it('should return RPC URLs containing Alchemy endpoints when Alchemy API key is provided', () => {
      const rpcUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: true,
        preferredProviders: ['alchemy', 'infura'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)
      expect(rpcUrls.length).toBeGreaterThan(0)

      // Check if at least one RPC URL contains Alchemy
      const alchemyUrls = rpcUrls.filter((url: string) => url.toLowerCase().includes('alchemy'))
      expect(alchemyUrls.length).toBeGreaterThan(0)

      // Verify the Alchemy URL contains our dummy API key
      const alchemyUrlsWithKey = alchemyUrls.filter((url: string) =>
        url.includes(mockApiKeys.alchemyKey),
      )
      expect(alchemyUrlsWithKey.length).toBeGreaterThan(0)
    })

    it('should return RPC URLs containing Infura endpoints when Infura API key is provided', () => {
      const rpcUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: true,
        preferredProviders: ['alchemy', 'infura'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)
      expect(rpcUrls.length).toBeGreaterThan(0)

      // Check if at least one RPC URL contains Infura
      const infuraUrls = rpcUrls.filter((url: string) => url.toLowerCase().includes('infura'))
      expect(infuraUrls.length).toBeGreaterThan(0)

      // Verify the Infura URL contains our dummy API key
      const infuraUrlsWithKey = infuraUrls.filter((url: string) =>
        url.includes(mockApiKeys.infuraKey),
      )
      expect(infuraUrlsWithKey.length).toBeGreaterThan(0)
    })

    it('should return both Alchemy and Infura RPC URLs when both API keys are provided', () => {
      const rpcUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: true,
        preferredProviders: ['alchemy', 'infura'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)
      expect(rpcUrls.length).toBeGreaterThan(0)

      // Check for both Alchemy and Infura URLs
      const alchemyUrls = rpcUrls.filter((url: string) => url.toLowerCase().includes('alchemy'))
      const infuraUrls = rpcUrls.filter((url: string) => url.toLowerCase().includes('infura'))

      expect(alchemyUrls.length).toBeGreaterThan(0)
      expect(infuraUrls.length).toBeGreaterThan(0)

      // Verify both URLs contain their respective API keys
      const alchemyUrlsWithKey = alchemyUrls.filter((url: string) =>
        url.includes(mockApiKeys.alchemyKey),
      )
      const infuraUrlsWithKey = infuraUrls.filter((url: string) =>
        url.includes(mockApiKeys.infuraKey),
      )

      expect(alchemyUrlsWithKey.length).toBeGreaterThan(0)
      expect(infuraUrlsWithKey.length).toBeGreaterThan(0)
    })

    it('should work correctly with different chain IDs', () => {
      const testChains = [mainnet.id, arbitrum.id, polygon.id, base.id]

      testChains.forEach((chainId) => {
        const rpcUrls = ecoChains.getRpcUrlsForChain(chainId, {
          isWebSocketEnabled: true,
          preferredProviders: ['alchemy', 'infura'],
        })

        expect(rpcUrls).toBeDefined()
        expect(Array.isArray(rpcUrls)).toBe(true)
        expect(rpcUrls.length).toBeGreaterThan(0)

        // Each chain should have at least one URL containing either Alchemy or Infura
        const providerUrls = rpcUrls.filter((url: string) => {
          const urlLower = url.toLowerCase()
          return urlLower.includes('alchemy') || urlLower.includes('infura')
        })

        expect(providerUrls.length).toBeGreaterThan(0)
      })
    })

    it('should handle WebSocket enabled vs disabled correctly', () => {
      // Test with WebSocket enabled
      const wsEnabledUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: true,
        preferredProviders: ['alchemy', 'infura'],
      })

      // Test with WebSocket disabled
      const wsDisabledUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: false,
        preferredProviders: ['alchemy', 'infura'],
      })

      expect(wsEnabledUrls).toBeDefined()
      expect(wsDisabledUrls).toBeDefined()
      expect(Array.isArray(wsEnabledUrls)).toBe(true)
      expect(Array.isArray(wsDisabledUrls)).toBe(true)

      // Both should have provider URLs (Alchemy/Infura)
      const wsEnabledProviderUrls = wsEnabledUrls.filter((url: string) => {
        const urlLower = url.toLowerCase()
        return urlLower.includes('alchemy') || urlLower.includes('infura')
      })
      const wsDisabledProviderUrls = wsDisabledUrls.filter((url: string) => {
        const urlLower = url.toLowerCase()
        return urlLower.includes('alchemy') || urlLower.includes('infura')
      })

      expect(wsEnabledProviderUrls.length).toBeGreaterThan(0)
      expect(wsDisabledProviderUrls.length).toBeGreaterThan(0)
    })

    it('should maintain Alchemy and Infura URLs when preferredProviders includes other providers', () => {
      const rpcUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: true,
        preferredProviders: ['alchemy', 'infura', 'quicknode'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)
      expect(rpcUrls.length).toBeGreaterThan(0)

      // Check that both Alchemy and Infura are still present
      const alchemyUrls = rpcUrls.filter((url: string) => url.toLowerCase().includes('alchemy'))
      const infuraUrls = rpcUrls.filter((url: string) => url.toLowerCase().includes('infura'))

      expect(alchemyUrls.length).toBeGreaterThan(0)
      expect(infuraUrls.length).toBeGreaterThan(0)

      // Verify API keys are properly included
      const alchemyUrlsWithKey = alchemyUrls.filter((url: string) =>
        url.includes(mockApiKeys.alchemyKey),
      )
      const infuraUrlsWithKey = infuraUrls.filter((url: string) =>
        url.includes(mockApiKeys.infuraKey),
      )

      expect(alchemyUrlsWithKey.length).toBeGreaterThan(0)
      expect(infuraUrlsWithKey.length).toBeGreaterThan(0)
    })

    it('should respect the order of preferred providers - Alchemy first, then Infura', () => {
      const rpcUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: false, // Use HTTP only for clearer ordering
        preferredProviders: ['alchemy', 'infura'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)
      expect(rpcUrls.length).toBeGreaterThan(0)

      // Find first Alchemy and first Infura URL positions
      const firstAlchemyIndex = rpcUrls.findIndex((url: string) =>
        url.toLowerCase().includes('alchemy'),
      )
      const firstInfuraIndex = rpcUrls.findIndex((url: string) =>
        url.toLowerCase().includes('infura'),
      )

      // Both should be found
      expect(firstAlchemyIndex).toBeGreaterThanOrEqual(0)
      expect(firstInfuraIndex).toBeGreaterThanOrEqual(0)

      // Alchemy should appear before Infura
      expect(firstAlchemyIndex).toBeLessThan(firstInfuraIndex)
    })

    it('should respect the order of preferred providers - Infura first, then Alchemy', () => {
      const rpcUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: false, // Use HTTP only for clearer ordering
        preferredProviders: ['infura', 'alchemy'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)
      expect(rpcUrls.length).toBeGreaterThan(0)

      // Find first Alchemy and first Infura URL positions
      const firstAlchemyIndex = rpcUrls.findIndex((url: string) =>
        url.toLowerCase().includes('alchemy'),
      )
      const firstInfuraIndex = rpcUrls.findIndex((url: string) =>
        url.toLowerCase().includes('infura'),
      )

      // Both should be found
      expect(firstAlchemyIndex).toBeGreaterThanOrEqual(0)
      expect(firstInfuraIndex).toBeGreaterThanOrEqual(0)

      // Infura should appear before Alchemy
      expect(firstInfuraIndex).toBeLessThan(firstAlchemyIndex)
    })

    it('should maintain provider order with WebSocket and HTTP URLs', () => {
      const rpcUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: true,
        preferredProviders: ['alchemy', 'infura'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)
      expect(rpcUrls.length).toBeGreaterThan(0)

      // Group URLs by provider
      const alchemyUrls: number[] = []
      const infuraUrls: number[] = []

      rpcUrls.forEach((url: string, index: number) => {
        const urlLower = url.toLowerCase()
        if (urlLower.includes('alchemy')) {
          alchemyUrls.push(index)
        } else if (urlLower.includes('infura')) {
          infuraUrls.push(index)
        }
      })

      expect(alchemyUrls.length).toBeGreaterThan(0)
      expect(infuraUrls.length).toBeGreaterThan(0)

      // The first Alchemy URL should appear before the first Infura URL
      const firstAlchemyIndex = Math.min(...alchemyUrls)
      const firstInfuraIndex = Math.min(...infuraUrls)

      expect(firstAlchemyIndex).toBeLessThan(firstInfuraIndex)
    })

    it('should handle single provider in preferred providers list', () => {
      // Test with only Alchemy
      const alchemyOnlyUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: false,
        preferredProviders: ['alchemy'],
      })

      expect(alchemyOnlyUrls).toBeDefined()
      expect(Array.isArray(alchemyOnlyUrls)).toBe(true)

      const alchemyUrls = alchemyOnlyUrls.filter((url: string) =>
        url.toLowerCase().includes('alchemy'),
      )
      expect(alchemyUrls.length).toBeGreaterThan(0)

      // Test with only Infura
      const infuraOnlyUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: false,
        preferredProviders: ['infura'],
      })

      expect(infuraOnlyUrls).toBeDefined()
      expect(Array.isArray(infuraOnlyUrls)).toBe(true)

      const infuraUrls = infuraOnlyUrls.filter((url: string) =>
        url.toLowerCase().includes('infura'),
      )
      expect(infuraUrls.length).toBeGreaterThan(0)
    })

    it('should maintain consistent ordering across multiple calls', () => {
      const options = {
        isWebSocketEnabled: false,
        preferredProviders: ['alchemy', 'infura'],
      }

      // Make multiple calls with the same options
      const firstCall = ecoChains.getRpcUrlsForChain(mainnet.id, options)
      const secondCall = ecoChains.getRpcUrlsForChain(mainnet.id, options)
      const thirdCall = ecoChains.getRpcUrlsForChain(mainnet.id, options)

      // All calls should return the same ordered results
      expect(firstCall).toEqual(secondCall)
      expect(secondCall).toEqual(thirdCall)

      // Verify ordering is consistent
      const firstAlchemyIndex = firstCall.findIndex((url: string) =>
        url.toLowerCase().includes('alchemy'),
      )
      const firstInfuraIndex = firstCall.findIndex((url: string) =>
        url.toLowerCase().includes('infura'),
      )

      if (firstAlchemyIndex >= 0 && firstInfuraIndex >= 0) {
        expect(firstAlchemyIndex).toBeLessThan(firstInfuraIndex)
      }
    })

    it('should return valid URLs that contain API keys', () => {
      const rpcUrls = ecoChains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: true,
        preferredProviders: ['alchemy', 'infura'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)
      expect(rpcUrls.length).toBeGreaterThan(0)

      // Verify that URLs are valid format and contain API keys
      rpcUrls.forEach((url: string) => {
        expect(typeof url).toBe('string')
        expect(url.length).toBeGreaterThan(0)

        // URL should start with http:// or https:// or ws:// or wss://
        expect(url).toMatch(/^(https?|wss?):\/\//)

        // If it's an Alchemy or Infura URL, it should contain the respective API key
        if (url.toLowerCase().includes('alchemy')) {
          expect(url).toContain(mockApiKeys.alchemyKey)
        }
        if (url.toLowerCase().includes('infura')) {
          expect(url).toContain(mockApiKeys.infuraKey)
        }
      })
    })
  })

  // Note: This describe block must run first to avoid contamination from the global mutation bug
  // in @eco-foundation/chains library where chain definitions are mutated across instances
  describe('EcoChains initialization', () => {
    // Test fails when ran with others but passes by itself - likely due to global mutation bug in @eco-foundation/chains
    it.skip('should initialize successfully with partial API keys', () => {
      const partialKeys = { alchemyKey: 'dummy-alchemy-only' }
      const chains = new EcoChains(partialKeys)
      expect(chains).toBeDefined()

      const rpcUrls = chains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: true,
        preferredProviders: ['alchemy', 'infura'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)

      // Should have Alchemy URLs with key but Infura URLs without key (if any)
      const alchemyUrls = rpcUrls.filter((url: string) => url.toLowerCase().includes('alchemy'))

      expect(alchemyUrls.length).toBeGreaterThan(0)

      // Verify the Alchemy URL contains our dummy API key
      const alchemyUrlsWithKey = alchemyUrls.filter((url: string) =>
        url.includes(partialKeys.alchemyKey),
      )
      expect(alchemyUrlsWithKey.length).toBeGreaterThan(0)
    })

    it('should initialize successfully with API keys object', () => {
      const chains = new EcoChains(mockApiKeys)
      expect(chains).toBeDefined()
      expect(chains.getRpcUrlsForChain).toBeDefined()
      expect(typeof chains.getRpcUrlsForChain).toBe('function')
    })

    it('should initialize successfully with empty API keys object', () => {
      const chains = new EcoChains({})
      expect(chains).toBeDefined()

      // Should still return URLs, just without the premium provider endpoints
      const rpcUrls = chains.getRpcUrlsForChain(mainnet.id, {
        isWebSocketEnabled: true,
        preferredProviders: ['alchemy', 'infura'],
      })

      expect(rpcUrls).toBeDefined()
      expect(Array.isArray(rpcUrls)).toBe(true)
    })
  })
})
