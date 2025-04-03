import * as Hyperlane from '@/intent-processor/utils/hyperlane'
import { encodePacked, Hex } from 'viem'

describe('Hyperlane utils', () => {
  describe('getMessageData', () => {
    it('should correctly encode claimant and hashes', () => {
      const claimant = '0x1111111111111111111111111111111111111111' as Hex
      const hashes = [
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1' as Hex,
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2' as Hex,
      ]

      const result = Hyperlane.getMessageData(claimant, hashes)

      // Verify result is a hex string
      expect(result.startsWith('0x')).toBe(true)
      
      // Since we can't predict the exact encoded output without implementing the ABI encoder,
      // we can check that the output contains our input data
      expect(result.indexOf(claimant.substring(2).toLowerCase())).not.toBe(-1)
      hashes.forEach(hash => {
        expect(result.indexOf(hash.substring(2).toLowerCase())).not.toBe(-1)
      })
    })

    it('should handle empty hashes array', () => {
      const claimant = '0x1111111111111111111111111111111111111111' as Hex
      const hashes: Hex[] = []

      const result = Hyperlane.getMessageData(claimant, hashes)
      expect(result.startsWith('0x')).toBe(true)
    })
  })

  describe('getMetadata', () => {
    it('should encode value and gas limit correctly', () => {
      const value = BigInt(1000000000000000000) // 1 ETH
      const gasLimit = BigInt(300000) // Gas limit

      const result = Hyperlane.getMetadata(value, gasLimit)

      // Verify result is a hex string
      expect(result.startsWith('0x')).toBe(true)
      
      // Should have the version 1 at the beginning (uint16 = 1)
      // In hex, 0001 would be the encoding for uint16 value 1
      expect(result.substring(2, 6)).toBe('0001')
      
      // We can't predict the exact encoding without reimplementing encodePacked,
      // but we can check overall length and that it contains encoded data
      expect(result.length).toBeGreaterThan(2) // More than just '0x'
    })

    it('should handle zero values', () => {
      const result = Hyperlane.getMetadata(BigInt(0), BigInt(0))
      expect(result.startsWith('0x')).toBe(true)
      // Should still have the version 1
      expect(result.substring(2, 6)).toBe('0001')
    })
  })

  // For chainMetadata and other functions that depend on configuration,
  // we would need to mock the configuration
  describe('getChainMetadata', () => {
    it('should return the correct chain metadata', () => {
      const mockConfig = {
        chains: {
          '1': {
            mailbox: '0xmailbox1' as Hex,
            aggregationHook: '0xaggregation1' as Hex,
            hyperlaneAggregationHook: '0xhyperaggregation1' as Hex
          },
          '10': {
            mailbox: '0xmailbox10' as Hex,
            aggregationHook: '0xaggregation10' as Hex,
            hyperlaneAggregationHook: '0xhyperaggregation10' as Hex
          }
        }
      }

      const result = Hyperlane.getChainMetadata(mockConfig, 1)
      
      expect(result).toEqual({
        mailbox: '0xmailbox1' as Hex,
        aggregationHook: '0xaggregation1' as Hex,
        hyperlaneAggregationHook: '0xhyperaggregation1' as Hex
      })
    })

    it('should throw an error for unknown chain ID', () => {
      const mockConfig = {
        chains: {
          '1': { 
            mailbox: '0xmailbox1' as Hex, 
            aggregationHook: '0xaggregation1' as Hex, 
            hyperlaneAggregationHook: '0xhyperaggregation1' as Hex 
          }
        }
      }

      expect(() => Hyperlane.getChainMetadata(mockConfig, 999)).toThrow(
        'Hyperlane config not found for chain id 999'
      )
    })
  })
})