import { Hex } from 'viem'
import { getWithdrawData } from '@eco-solver/intent-processor/utils/intent'
import { IndexerIntent } from '@eco-solver/indexer/interfaces/intent.interface'

describe('Intent Utils', () => {
  describe('getWithdrawData', () => {
    it('should convert IndexerIntent to proper format for withdrawal', () => {
      // Create mock IndexerIntent
      const mockIntent: IndexerIntent = {
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
      const expectedRoute = {
        calls: [
          {
            data: '0xData1',
            target: '0xTarget1',
            value: 100000000000000000n,
          },
          {
            data: '0xData2',
            target: '0xTarget2',
            value: 200000000000000000n,
          },
        ],
        destination: 2n,
        inbox: '0xInbox',
        salt: '0xSalt',
        source: 1n,
        tokens: [
          {
            amount: 4000000000000000000n,
            token: '0xToken3',
          },
          {
            amount: 5000000000000000000n,
            token: '0xToken4',
          },
        ],
      }

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

      // Verify result
      expect(result).toEqual({
        route: expectedRoute,
        reward: expectedReward,
      })
    })
  })
})
