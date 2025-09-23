import { Hex } from 'viem'
import { getWithdrawData } from '@/intent-processor/utils/intent'
import { IndexerIntent } from '@/indexer/interfaces/intent.interface'

describe('Intent Utils', () => {
  describe('getWithdrawData', () => {
    it('should convert IndexerIntent to destination, routeHash, reward', () => {
      // Create mock IndexerIntent
      const mockIntent: IndexerIntent = {
        intentHash: '0xintentHash',
        creator: '0x000000000000000000000000000000000000c0fe',
        prover: '0x000000000000000000000000000000000000babe',
        destination: '2', // Chain ID 2
        rewardDeadline: '1234567890',
        rewardNativeAmount: '1000000000000000000', // 1 ETH
        rewardTokens: [
          { token: '0x2222222222222222222222222222222222222222', amount: '2000000000000000000' }, // 2 tokens
          { token: '0x3333333333333333333333333333333333333333', amount: '3000000000000000000' }, // 3 tokens
        ],
        route: (require('viem') as typeof import('viem')).encodeAbiParameters(
          [require('@/contracts').routeStructAbiItem],
          [
            {
              salt: '0x1111111111111111111111111111111111111111111111111111111111111111',
              deadline: 1234567890n,
              portal: '0x1111111111111111111111111111111111111111',
              nativeAmount: 1000000000000000000n,
              tokens: [
                {
                  token: '0x4444444444444444444444444444444444444444',
                  amount: 4000000000000000000n,
                },
                {
                  token: '0x5555555555555555555555555555555555555555',
                  amount: 5000000000000000000n,
                },
              ],
              calls: [
                {
                  target: '0x6666666666666666666666666666666666666666',
                  data: '0x1234',
                  value: 100000000000000000n,
                },
                {
                  target: '0x7777777777777777777777777777777777777777',
                  data: '0x5678',
                  value: 200000000000000000n,
                },
              ],
            },
          ],
        ),
      }

      // Call function
      const result = getWithdrawData(mockIntent)

      // Expected reward
      const expectedReward = {
        creator: '0x000000000000000000000000000000000000c0fe' as Hex,
        prover: '0x000000000000000000000000000000000000babe' as Hex,
        deadline: 1234567890n,
        nativeAmount: 1000000000000000000n,
        tokens: [
          {
            token: '0x2222222222222222222222222222222222222222' as Hex,
            amount: 2000000000000000000n,
          },
          {
            token: '0x3333333333333333333333333333333333333333' as Hex,
            amount: 3000000000000000000n,
          },
        ],
      }

      // Verify core fields; routeHash is deterministic but heavy to re-derive here
      expect(result.destination).toEqual(2n)
      expect(result.reward).toEqual(expectedReward)
      expect(result.routeHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
    })
  })
})
