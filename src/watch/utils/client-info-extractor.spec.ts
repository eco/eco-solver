import { sanitizeRpcUrl, extractChainId, extractSanitizedRpcUrl } from './client-info-extractor'
import { PublicClient } from 'viem'

describe('ClientInfoExtractor', () => {
  describe('sanitizeRpcUrl', () => {
    it('should mask API keys in query parameters', () => {
      const url = 'https://eth-mainnet.g.alchemy.com/v2/abc123?apikey=secret123'
      const result = sanitizeRpcUrl(url)
      expect(result).toContain('apikey=***')
      expect(result).not.toContain('secret123')
    })

    it('should mask API keys in path segments', () => {
      const url = 'https://eth-mainnet.g.alchemy.com/v2/abc123def456ghi789'
      const result = sanitizeRpcUrl(url)
      expect(result).toContain('/v2/***')
      expect(result).not.toContain('abc123def456ghi789')
    })

    it('should handle WebSocket URLs', () => {
      const url = 'wss://eth-mainnet.g.alchemy.com/v2/your_api_key_here'
      const result = sanitizeRpcUrl(url)
      expect(result).toContain('wss://')
      expect(result).toContain('/v2/***')
    })

    it('should handle multiple API key patterns', () => {
      const url = 'https://example.com/api/key123?token=secret&auth=private'
      const result = sanitizeRpcUrl(url)
      expect(result).toContain('token=***')
      expect(result).toContain('auth=***')
      expect(result).toContain('/api/***')
    })

    it('should handle invalid URLs gracefully', () => {
      const result = sanitizeRpcUrl('not-a-valid-url')
      expect(result).toBe('***')
    })

    it('should preserve normal path segments', () => {
      const url = 'https://example.com/api/v1/public'
      const result = sanitizeRpcUrl(url)
      expect(result).toBe('https://example.com/api/v1/public')
    })
  })

  describe('extractChainId', () => {
    it('should extract chainId from client', () => {
      const mockClient = {
        chain: { id: 1, name: 'Ethereum' },
      } as PublicClient

      const result = extractChainId(mockClient)
      expect(result).toBe(1)
    })

    it('should return unknown when chain is undefined', () => {
      const mockClient = {} as PublicClient

      const result = extractChainId(mockClient)
      expect(result).toBe('unknown')
    })

    it('should return unknown when chain.id is undefined', () => {
      const mockClient = {
        chain: { name: 'Test' },
      } as any

      const result = extractChainId(mockClient)
      expect(result).toBe('unknown')
    })
  })

  describe('extractSanitizedRpcUrl', () => {
    it('should extract URL from HTTP transport', () => {
      const mockClient = {
        transport: {
          url: 'https://eth-mainnet.g.alchemy.com/v2/abc123',
        },
      } as any

      const result = extractSanitizedRpcUrl(mockClient)
      expect(result).toContain('https://eth-mainnet.g.alchemy.com/v2/***')
    })

    it('should extract URL from WebSocket transport', () => {
      const mockClient = {
        transport: {
          socket: {
            url: 'wss://eth-mainnet.g.alchemy.com/v2/abc123',
          },
        },
      } as any

      const result = extractSanitizedRpcUrl(mockClient)
      expect(result).toContain('wss://eth-mainnet.g.alchemy.com/v2/***')
    })

    it('should extract URL from fallback transport array', () => {
      const mockClient = {
        transport: {
          transports: [
            { url: 'https://primary.rpc.com/api/key123' },
            { url: 'https://fallback.rpc.com/api/key456' },
          ],
        },
      } as any

      const result = extractSanitizedRpcUrl(mockClient)
      expect(result).toContain('https://primary.rpc.com/api/***')
    })

    it('should return unknown for unsupported transport types', () => {
      const mockClient = {
        transport: 'string-transport',
      } as any

      const result = extractSanitizedRpcUrl(mockClient)
      expect(result).toBe('unknown')
    })

    it('should handle missing transport gracefully', () => {
      const mockClient = {} as PublicClient

      const result = extractSanitizedRpcUrl(mockClient)
      expect(result).toBe('unknown')
    })
  })
})
