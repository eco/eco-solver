import { Hex } from 'viem'
import * as RoutesTs from '@eco-foundation/routes-ts'
import { getWithdrawData } from '@/intent-processor/utils/intent'
import { IndexerIntentDTO } from '@/indexer/interfaces/intent.interface'

// Mock the routes-ts module
jest.mock('@eco-foundation/routes-ts', () => ({
  hashIntent: jest.fn().mockReturnValue({ routeHash: '0xRoutehash' }),
}))

describe('Intent Utils', () => {
  describe('getWithdrawData', () => {
    it('should convert IndexerIntentDTO to proper format for withdrawal', () => {
      // Create mock IndexerIntentDTO
      const mockIntent: IndexerIntentDTO = {
        hash: '0xintentHash',
        creator: '0xCreator',
        prover: '0xProver',
        inbox: '0xInbox',
        deadline: '1234567890',
        nativeValue: '1000000000000000000', // 1 ETH
        salt: '0xSalt',
        source: '1', // Chain ID 1
        destination: '2', // Chain ID 2
        rewardTokens: [
          { token: '0xToken1', amount: '2000000000000000000' }, // 2 tokens
          { token: '0xToken2', amount: '3000000000000000000' }, // 3 tokens
        ],
        routeTokens: [
          { token: '0xToken3', amount: '4000000000000000000' }, // 4 tokens
          { token: '0xToken4', amount: '5000000000000000000' }, // 5 tokens
        ],
        calls: [
          {
            target: '0xTarget1',
            data: '0xData1',
            value: '100000000000000000', // 0.1 ETH
          },
          {
            target: '0xTarget2',
            data: '0xData2',
            value: '200000000000000000', // 0.2 ETH
          },
        ],
      }

      // Call function
      const result = getWithdrawData(mockIntent)

      // Expected reward
      const expectedReward = {
        creator: '0xCreator' as Hex,
        prover: '0xProver' as Hex,
        deadline: 1234567890n,
        nativeValue: 1000000000000000000n,
        tokens: [
          { token: '0xToken1' as Hex, amount: 2000000000000000000n },
          { token: '0xToken2' as Hex, amount: 3000000000000000000n },
        ],
      }

      // Expected route
      const expectedRoute = {
        salt: '0xSalt' as Hex,
        source: 1n,
        destination: 2n,
        inbox: '0xInbox' as Hex,
        tokens: [
          { token: '0xToken3' as Hex, amount: 4000000000000000000n },
          { token: '0xToken4' as Hex, amount: 5000000000000000000n },
        ],
        calls: [
          {
            target: '0xTarget1' as Hex,
            data: '0xData1' as Hex,
            value: 100000000000000000n,
          },
          {
            target: '0xTarget2' as Hex,
            data: '0xData2' as Hex,
            value: 200000000000000000n,
          },
        ],
      }

      // Verify hashIntent was called with correct parameters
      expect(RoutesTs.hashIntent).toHaveBeenCalledWith({
        reward: expectedReward,
        route: expectedRoute,
      })

      // Verify result
      expect(result).toEqual({
        reward: expectedReward,
        routeHash: '0xRoutehash',
      })
    })
  })
})
