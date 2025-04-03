import { Hex } from 'viem'
import { getWithdrawData } from '@/intent-processor/utils/intent'
import { IndexerIntent } from '@/indexer/interfaces/intent.interface'

// Mock the hashIntent function before using it
jest.mock('@eco-foundation/routes-ts', () => ({
  hashIntent: jest.fn().mockReturnValue({ routeHash: '0xroute_hash_from_lib' as Hex }),
}))

describe('Intent Utilities', () => {
  describe('getWithdrawData', () => {
    it('should convert IndexerIntent to the correct format', () => {
      // Create a mock intent with all required fields
      const mockIntent: IndexerIntent = {
        hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        creator: '0x2222222222222222222222222222222222222222' as Hex,
        prover: '0x3333333333333333333333333333333333333333' as Hex,
        salt: '0x4444444444444444444444444444444444444444444444444444444444444444' as Hex,
        source: '1',
        destination: '10',
        inbox: '0x5555555555555555555555555555555555555555' as Hex,
        deadline: '1234567890',
        nativeValue: '1000000000000000000', // 1 ETH
        rewardTokens: [
          {
            token: '0x6666666666666666666666666666666666666666' as Hex,
            amount: '1000000000000000000', // 1 token
          },
          {
            token: '0x7777777777777777777777777777777777777777' as Hex,
            amount: '2000000000000000000', // 2 tokens
          },
        ],
        routeTokens: [
          {
            token: '0x8888888888888888888888888888888888888888' as Hex,
            amount: '3000000000000000000', // 3 tokens
          },
        ],
        calls: [
          {
            target: '0x9999999999999999999999999999999999999999' as Hex,
            data: '0xabcdef' as Hex,
            value: '500000000000000000', // 0.5 ETH
          },
        ],
      }

      // Call the function
      const result = getWithdrawData(mockIntent)

      // Verify the result structure
      expect(result).toHaveProperty('reward')
      expect(result).toHaveProperty('routeHash')
      
      // Verify the reward object has been properly constructed
      expect(result.reward).toEqual({
        creator: '0x2222222222222222222222222222222222222222',
        prover: '0x3333333333333333333333333333333333333333',
        deadline: BigInt(1234567890),
        nativeValue: BigInt('1000000000000000000'),
        tokens: [
          {
            token: '0x6666666666666666666666666666666666666666',
            amount: BigInt('1000000000000000000'),
          },
          {
            token: '0x7777777777777777777777777777777777777777',
            amount: BigInt('2000000000000000000'),
          },
        ],
      })
      
      // Verify that the route hash is generated using hashIntent
      expect(result.routeHash).toBe('0xroute_hash_from_lib')
      
      // Verify that hashIntent was called
      const hashIntent = require('@eco-foundation/routes-ts').hashIntent;
      expect(hashIntent).toHaveBeenCalled()
    })

    it('should handle empty arrays in intent data', () => {
      // Create a mock intent with minimal data
      const mockIntent: IndexerIntent = {
        hash: '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex,
        creator: '0x2222222222222222222222222222222222222222' as Hex,
        prover: '0x3333333333333333333333333333333333333333' as Hex,
        salt: '0x4444444444444444444444444444444444444444444444444444444444444444' as Hex,
        source: '1',
        destination: '10',
        inbox: '0x5555555555555555555555555555555555555555' as Hex,
        deadline: '1234567890',
        nativeValue: '1000000000000000000', // 1 ETH
        rewardTokens: [], // Empty reward tokens
        routeTokens: [], // Empty route tokens
        calls: [], // Empty calls
      }

      // Call the function
      const result = getWithdrawData(mockIntent)

      // Verify the result has empty arrays
      expect(result.reward.tokens).toEqual([])
      
      // Verify hashIntent was called
      const hashIntent = require('@eco-foundation/routes-ts').hashIntent;
      expect(hashIntent).toHaveBeenCalled()
    })
  })
})
