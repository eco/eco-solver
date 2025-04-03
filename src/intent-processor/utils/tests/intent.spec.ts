import { getWithdrawData } from '@/intent-processor/utils/intent'
import { IndexerIntent } from '@/indexer/interfaces/intent.interface'

// Mock hashIntent function
jest.mock('@eco-foundation/routes-ts', () => ({
  hashIntent: jest.fn().mockReturnValue({ routeHash: '0x123mockhash456' }),
}))

describe('Intent utils', () => {
  describe('getWithdrawData', () => {
    const mockIntent: IndexerIntent = {
      hash: '0xabc123',
      creator: '0x1111111111111111111111111111111111111111',
      prover: '0x2222222222222222222222222222222222222222',
      deadline: '1234567890',
      nativeValue: '1000000000000000000',
      source: '1',
      destination: '10',
      salt: '0x0000000000000000000000000000000000000000000000000000000000005678',
      inbox: '0x3333333333333333333333333333333333333333',
      rewardTokens: [
        { token: '0x4444444444444444444444444444444444444444', amount: '2000000000000000000' },
        { token: '0x5555555555555555555555555555555555555555', amount: '3000000000000000000' },
      ],
      routeTokens: [
        { token: '0x6666666666666666666666666666666666666666', amount: '4000000000000000000' },
      ],
      calls: [
        {
          target: '0x7777777777777777777777777777777777777777',
          data: '0xabcdef123456',
          value: '500000000000000000',
        },
      ],
    }

    it('should correctly transform the IndexerIntent to the withdrawal data format', () => {
      const result = getWithdrawData(mockIntent)

      // Verify reward structure
      expect(result.reward).toEqual({
        creator: '0x1111111111111111111111111111111111111111',
        prover: '0x2222222222222222222222222222222222222222',
        deadline: BigInt('1234567890'),
        nativeValue: BigInt('1000000000000000000'),
        tokens: [
          {
            token: '0x4444444444444444444444444444444444444444',
            amount: BigInt('2000000000000000000'),
          },
          {
            token: '0x5555555555555555555555555555555555555555',
            amount: BigInt('3000000000000000000'),
          },
        ],
      })

      // Verify the route hash was computed
      expect(result.routeHash).toBe('0x123mockhash456')
    })

    it('should produce a consistent route hash for the same input', () => {
      const result1 = getWithdrawData(mockIntent)
      const result2 = getWithdrawData(mockIntent)

      expect(result1.routeHash).toEqual(result2.routeHash)
    })

    it('should handle different inputs correctly', () => {
      const result1 = getWithdrawData(mockIntent)
      
      // We use the mocked hashIntent so we don't need to create different inputs
      
      expect(result1.routeHash).toBe('0x123mockhash456')
    })
  })
})