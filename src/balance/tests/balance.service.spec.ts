import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { BalanceService } from '@/balance/services/balance.service'
import { BalanceRecordRepository } from '@/balance/repositories/balance-record.repository'
import { BalanceChangeRepository } from '@/balance/repositories/balance-change.repository'
import { RpcBalanceService } from '@/balance/services/rpc-balance.service'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { TokenConfig } from '@/balance/types/balance.types'
import { Hex } from 'viem'

describe('BalanceService', () => {
  let service: BalanceService
  let balanceRecordRepository: DeepMocked<BalanceRecordRepository>
  let balanceChangeRepository: DeepMocked<BalanceChangeRepository>
  let rpcBalanceService: DeepMocked<RpcBalanceService>
  let intentSourceRepository: DeepMocked<IntentSourceRepository>
  let configService: DeepMocked<EcoConfigService>
  let mockQueue: DeepMocked<Queue>

  const mockBalanceRecords = [
    {
      _id: '507f1f77bcf86cd799439011',
      chainId: '1',
      address: '0x1234567890123456789012345678901234567890',
      balance: '1000000000000000000',
      blockNumber: '18500000',
      blockHash: '0xabcdef',
      timestamp: new Date('2023-10-01T12:00:00Z'),
      decimals: 6,
    },
    {
      _id: '507f1f77bcf86cd799439012',
      chainId: '1',
      address: '0x9876543210987654321098765432109876543210',
      balance: '2000000000000000000',
      blockNumber: '18500100',
      blockHash: '0xfedcba',
      timestamp: new Date('2023-10-01T12:05:00Z'),
      decimals: 6,
    },
    {
      _id: '507f1f77bcf86cd799439013',
      chainId: '1',
      address: 'native',
      balance: '5000000000000000000',
      blockNumber: '18500200',
      blockHash: '0x123456',
      timestamp: new Date('2023-10-01T12:10:00Z'),
    },
  ] as any[]

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: BalanceRecordRepository,
          useValue: createMock<BalanceRecordRepository>(),
        },
        {
          provide: BalanceChangeRepository,
          useValue: createMock<BalanceChangeRepository>(),
        },
        {
          provide: RpcBalanceService,
          useValue: createMock<RpcBalanceService>(),
        },
        {
          provide: IntentSourceRepository,
          useValue: createMock<IntentSourceRepository>(),
        },
        {
          provide: EcoConfigService,
          useValue: createMock<EcoConfigService>(),
        },
        {
          provide: getQueueToken(QUEUES.BALANCE_MONITOR.queue),
          useValue: createMock<Queue>(),
        },
      ],
    }).compile()

    service = module.get<BalanceService>(BalanceService)
    balanceRecordRepository = module.get(BalanceRecordRepository)
    balanceChangeRepository = module.get(BalanceChangeRepository)
    rpcBalanceService = module.get(RpcBalanceService)
    intentSourceRepository = module.get(IntentSourceRepository)
    configService = module.get(EcoConfigService)
    mockQueue = module.get(getQueueToken(QUEUES.BALANCE_MONITOR.queue))

    // Setup config service mock
    configService.get.mockReturnValue({
      balanceRpcUpdate: {
        repeatOpts: {
          every: 3 * 60 * 1000, // 3 minutes
        },
      },
    })

    // Reset all mocks
    jest.clearAllMocks()
  })

  describe('getCurrentBalance', () => {
    const chainId = 1
    const address = '0x1234567890123456789012345678901234567890'

    it('should successfully get current balance with rewards', async () => {
      const balanceResult = {
        balance: BigInt('1000000000000000000'),
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      }
      const rewardAmount = BigInt('500000000000000000') // 0.5 ETH rewards

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getCurrentBalance(chainId, address)

      const expectedResult = {
        balance: BigInt('1500000000000000000'), // 1 + 0.5 ETH
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      }

      expect(result).toEqual(expectedResult)
      expect(balanceRecordRepository.getCurrentBalance).toHaveBeenCalledWith(
        '1',
        address,
        undefined,
      )
      expect(intentSourceRepository.calculateTotalRewardsForChainAndToken).toHaveBeenCalledWith(
        BigInt(1),
        address,
      )
    })

    it('should correctly aggregate base balance + outstanding changes + rewards', async () => {
      // Mock base balance record (RPC fetched balance)
      const baseBalance = BigInt('1000000000000000000') // 1 ETH base
      // Mock outstanding balance changes since last RPC update
      const outstandingChanges = BigInt('300000000000000000') // +0.3 ETH from transfers
      // Mock rewards from solved intents
      const rewardAmount = BigInt('200000000000000000') // +0.2 ETH rewards

      // Mock the full aggregation: base + outstanding + rewards
      const balanceResult = {
        balance: baseBalance + outstandingChanges, // Repository already includes outstanding changes
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      }

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getCurrentBalance(chainId, address)

      const expectedTotalBalance = baseBalance + outstandingChanges + rewardAmount
      expect(result).toEqual({
        balance: expectedTotalBalance, // 1 + 0.3 + 0.2 = 1.5 ETH
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      })
      expect(result!.balance.toString()).toBe('1500000000000000000')
    })

    it('should handle balance aggregation with negative outstanding changes', async () => {
      // Scenario: base balance but outgoing transfers exceed incoming
      const baseBalance = BigInt('2000000000000000000') // 2 ETH base
      const negativeOutstandingChanges = BigInt('-500000000000000000') // -0.5 ETH (more outgoing than incoming)
      const rewardAmount = BigInt('100000000000000000') // +0.1 ETH rewards

      const balanceResult = {
        balance: baseBalance + negativeOutstandingChanges, // 1.5 ETH after changes
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      }

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getCurrentBalance(chainId, address)

      expect(result).toEqual({
        balance: BigInt('1600000000000000000'), // 2 - 0.5 + 0.1 = 1.6 ETH
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      })
    })

    it('should handle zero rewards correctly in balance aggregation', async () => {
      const balanceResult = {
        balance: BigInt('1000000000000000000'), // 1 ETH from base + changes
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      }
      const zeroRewards = BigInt('0') // No rewards

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(zeroRewards)

      const result = await service.getCurrentBalance(chainId, address)

      expect(result).toEqual({
        balance: BigInt('1000000000000000000'), // Only base + changes, no rewards
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      })
    })

    it('should handle large balance values in aggregation', async () => {
      const largeBaseBalance = BigInt('999999999999999999999999') // Very large base
      const largeOutstandingChanges = BigInt('111111111111111111111111') // Large outstanding changes
      const largeRewards = BigInt('222222222222222222222222') // Large rewards

      const balanceResult = {
        balance: largeBaseBalance + largeOutstandingChanges,
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      }

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(largeRewards)

      const result = await service.getCurrentBalance(chainId, address)

      const expectedTotal = largeBaseBalance + largeOutstandingChanges + largeRewards
      expect(result).toEqual({
        balance: expectedTotal,
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      })
      expect(result!.balance.toString()).toBe('1333333333333333333333332')
    })

    it('should return null when no balance found', async () => {
      balanceRecordRepository.getCurrentBalance.mockResolvedValue(null)

      const result = await service.getCurrentBalance(chainId, address)

      expect(result).toBeNull()
      expect(balanceRecordRepository.getCurrentBalance).toHaveBeenCalledWith(
        '1',
        address,
        undefined,
      )
      // Should not call reward calculation if no balance record exists
      expect(intentSourceRepository.calculateTotalRewardsForChainAndToken).not.toHaveBeenCalled()
    })

    it('should handle specific block number with rewards', async () => {
      const blockNumber = '18500000'
      const balanceResult = {
        balance: BigInt('1000000000000000000'),
        blockNumber,
        decimals: 18,
        blockHash: '0xabcdef',
      }
      const rewardAmount = BigInt('200000000000000000') // 0.2 ETH rewards

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getCurrentBalance(chainId, address, blockNumber)

      const expectedResult = {
        balance: BigInt('1200000000000000000'), // 1 + 0.2 ETH
        blockNumber,
        decimals: 18,
        blockHash: '0xabcdef',
      }

      expect(result).toEqual(expectedResult)
      expect(balanceRecordRepository.getCurrentBalance).toHaveBeenCalledWith(
        '1',
        address,
        blockNumber,
      )
      expect(intentSourceRepository.calculateTotalRewardsForChainAndToken).toHaveBeenCalledWith(
        BigInt(1),
        address,
      )
    })

    it('should handle native balance correctly', async () => {
      const balanceResult = {
        balance: BigInt('5000000000000000000'),
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      }
      const rewardAmount = BigInt('1000000000000000000') // 1 ETH native rewards

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getCurrentBalance(chainId, 'native')

      const expectedResult = {
        balance: BigInt('6000000000000000000'), // 5 + 1 ETH
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      }

      expect(result).toEqual(expectedResult)
      expect(balanceRecordRepository.getCurrentBalance).toHaveBeenCalledWith(
        '1',
        'native',
        undefined,
      )
      expect(intentSourceRepository.calculateTotalRewardsForChainAndToken).toHaveBeenCalledWith(
        BigInt(1),
        undefined, // For native tokens, tokenAddress should be undefined
      )
    })

    it('should handle rewards calculation errors gracefully', async () => {
      const balanceResult = {
        balance: BigInt('1000000000000000000'),
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      }

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockRejectedValue(
        new Error('Intent source service unavailable'),
      )

      const result = await service.getCurrentBalance(chainId, address)

      // Should continue with balance even if rewards calculation fails
      expect(result).toEqual({
        balance: BigInt('1000000000000000000'), // Only base + changes, no rewards due to error
        blockNumber: '18500000',
        decimals: 18,
        blockHash: '0xabcdef',
      })
    })

    it('should verify balance repository aggregation is called correctly', async () => {
      const specificBlockNumber = '18500100'
      const balanceResult = {
        balance: BigInt('1000000000000000000'),
        blockNumber: specificBlockNumber,
        decimals: 18,
        blockHash: '0xabcdef',
      }
      const rewardAmount = BigInt('0')

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      await service.getCurrentBalance(chainId, address, specificBlockNumber)

      // Verify the repository is called with the specific block number
      expect(balanceRecordRepository.getCurrentBalance).toHaveBeenCalledWith(
        '1',
        address,
        specificBlockNumber,
      )

      // Note: The repository's getCurrentBalance method internally:
      // 1. Fetches the base BalanceRecord
      // 2. Calls balanceChangeRepository.calculateOutstandingBalance()
      // 3. Returns base balance + outstanding changes
      // This test validates the service calls the repository correctly
    })
  })

  describe('getCurrentNativeBalance', () => {
    const chainId = 1

    it('should get native balance with rewards', async () => {
      const balanceResult = {
        balance: BigInt('5000000000000000000'),
        blockNumber: '18500200',
        decimals: 18,
        blockHash: '0xabcdef',
      }
      const rewardAmount = BigInt('500000000000000000') // 0.5 ETH native rewards

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getNativeBalance(chainId)

      const expectedResult = {
        balance: BigInt('5500000000000000000'), // 5 + 0.5 ETH
        blockNumber: '18500200',
        decimals: 18,
        blockHash: '0xabcdef',
      }

      expect(result).toEqual(expectedResult)
      expect(balanceRecordRepository.getCurrentBalance).toHaveBeenCalledWith(
        '1',
        'native',
        undefined,
      )
      expect(intentSourceRepository.calculateTotalRewardsForChainAndToken).toHaveBeenCalledWith(
        BigInt(1),
        undefined, // For native tokens, tokenAddress should be undefined
      )
    })
  })

  describe('getAllBalancesForChain', () => {
    const chainId = 1

    it('should successfully fetch all balance records for a chain', async () => {
      balanceRecordRepository.findByChain.mockResolvedValue(mockBalanceRecords)

      const result = await service.getAllBalancesForChain(chainId)

      expect(result).toEqual(mockBalanceRecords)
      expect(balanceRecordRepository.findByChain).toHaveBeenCalledWith('1')
    })

    it('should return empty array when no records found', async () => {
      balanceRecordRepository.findByChain.mockResolvedValue([])

      const result = await service.getAllBalancesForChain(chainId)

      expect(result).toEqual([])
      expect(balanceRecordRepository.findByChain).toHaveBeenCalledWith('1')
    })

    it('should handle errors gracefully and return empty array', async () => {
      balanceRecordRepository.findByChain.mockRejectedValue(new Error('Database connection failed'))

      const result = await service.getAllBalancesForChain(chainId)

      expect(result).toEqual([])
      expect(balanceRecordRepository.findByChain).toHaveBeenCalledWith('1')
    })
  })

  describe('updateBalanceFromRpc', () => {
    const updateParams = {
      chainId: 1,
      address: '0x1234567890123456789012345678901234567890' as const,
      balance: '1000000000000000000',
      blockNumber: '18500000',
      blockHash: '0xabcdef',
      decimals: 18,
      tokenSymbol: 'TEST',
      tokenName: 'Test Token',
    }

    it('should update balance from RPC', async () => {
      const expectedResult = { ...updateParams, chainId: '1' } as any
      balanceRecordRepository.updateFromRpc.mockResolvedValue(expectedResult)

      const result = await service.updateBalanceFromRpc(updateParams)

      expect(result).toEqual(expectedResult)
      expect(balanceRecordRepository.updateFromRpc).toHaveBeenCalledWith({
        ...updateParams,
        chainId: '1',
      })
    })
  })

  describe('createBalanceChange', () => {
    const changeParams = {
      chainId: 1,
      address: 'native' as const,
      changeAmount: '1000000000000000000',
      direction: 'incoming' as const,
      blockNumber: '18500000',
      blockHash: '0xabcdef',
      transactionHash: '0x123456',
      from: '0x0000000000000000000000000000000000000001' as const,
      to: '0x0000000000000000000000000000000000000002' as const,
    }

    it('should create balance change', async () => {
      const expectedResult = { ...changeParams, chainId: '1' } as any
      balanceChangeRepository.createBalanceChange.mockResolvedValue(expectedResult)

      const result = await service.createBalanceChange(changeParams)

      expect(result).toEqual(expectedResult)
      expect(balanceChangeRepository.createBalanceChange).toHaveBeenCalledWith({
        ...changeParams,
        chainId: '1',
      })
    })
  })

  describe('getAllTokenDataForAddress', () => {
    const mockTokenConfigs: TokenConfig[] = [
      {
        address: '0x1234567890123456789012345678901234567890' as Hex,
        chainId: 1,
        minBalance: 100,
        targetBalance: 1000,
        type: 'erc20',
      },
      {
        address: '0x9876543210987654321098765432109876543210' as Hex,
        chainId: 1,
        minBalance: 200,
        targetBalance: 2000,
        type: 'erc20',
      },
      {
        address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as Hex,
        chainId: 137,
        minBalance: 50,
        targetBalance: 500,
        type: 'erc20',
      },
    ]

    const mockBalanceResults = {
      '0x1234567890123456789012345678901234567890': {
        balance: BigInt('1000000000000000000'),
        blockNumber: '18500000',
        decimals: 6,
        blockHash: '0xabcdef' as Hex,
      },
      '0x9876543210987654321098765432109876543210': {
        balance: BigInt('2000000000000000000'),
        blockNumber: '18500000',
        decimals: 6,
        blockHash: '0xabcdef' as Hex,
      },
    }

    const mockPolygonBalanceResults = {
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd': {
        balance: BigInt('500000000000000000'),
        blockNumber: '18500000',
        decimals: 6,
        blockHash: '0xfedcba' as Hex,
      },
    }

    beforeEach(() => {
      // Mock getTokenBalances to return different results for different chains
      jest
        .spyOn(service, 'getTokenBalances')
        .mockImplementation(async (chainId, tokenAddresses, blockNumber?) => {
          if (chainId === 1) {
            return mockBalanceResults
          } else if (chainId === 137) {
            return mockPolygonBalanceResults
          }
          return {}
        })
    })

    it('should successfully get token data for all chains', async () => {
      const result = await service.getAllTokenDataForAddress(mockTokenConfigs)

      expect(result).toHaveLength(3)
      expect(result).toEqual([
        {
          config: mockTokenConfigs[0],
          balance: mockBalanceResults['0x1234567890123456789012345678901234567890'],
          chainId: 1,
        },
        {
          config: mockTokenConfigs[1],
          balance: mockBalanceResults['0x9876543210987654321098765432109876543210'],
          chainId: 1,
        },
        {
          config: mockTokenConfigs[2],
          balance: mockPolygonBalanceResults['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'],
          chainId: 137,
        },
      ])

      expect(service.getTokenBalances).toHaveBeenCalledWith(
        1,
        [
          '0x1234567890123456789012345678901234567890',
          '0x9876543210987654321098765432109876543210',
        ],
        undefined,
      )
      expect(service.getTokenBalances).toHaveBeenCalledWith(
        137,
        ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'],
        undefined,
      )
    })

    it('should handle empty token configs array', async () => {
      const result = await service.getAllTokenDataForAddress([])

      expect(result).toEqual([])
      expect(service.getTokenBalances).not.toHaveBeenCalled()
    })

    it('should handle single chain with multiple tokens', async () => {
      const singleChainTokens = mockTokenConfigs.slice(0, 2) // Only Ethereum tokens

      const result = await service.getAllTokenDataForAddress(singleChainTokens)

      expect(result).toHaveLength(2)
      expect(result[0].chainId).toBe(1)
      expect(result[1].chainId).toBe(1)
      expect(service.getTokenBalances).toHaveBeenCalledTimes(1)
      expect(service.getTokenBalances).toHaveBeenCalledWith(
        1,
        [
          '0x1234567890123456789012345678901234567890',
          '0x9876543210987654321098765432109876543210',
        ],
        undefined,
      )
    })

    it('should handle single token on single chain', async () => {
      const singleToken = [mockTokenConfigs[0]]

      const result = await service.getAllTokenDataForAddress(singleToken)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        config: mockTokenConfigs[0],
        balance: mockBalanceResults['0x1234567890123456789012345678901234567890'],
        chainId: 1,
      })
      expect(service.getTokenBalances).toHaveBeenCalledWith(
        1,
        ['0x1234567890123456789012345678901234567890'],
        undefined,
      )
    })

    it('should pass blockNumber parameter correctly', async () => {
      const blockNumber = '18500000'
      const singleToken = [mockTokenConfigs[0]]

      await service.getAllTokenDataForAddress(singleToken, blockNumber)

      expect(service.getTokenBalances).toHaveBeenCalledWith(
        1,
        ['0x1234567890123456789012345678901234567890'],
        blockNumber,
      )
    })

    it('should filter out undefined balance results', async () => {
      // Mock getTokenBalances to return partial results (simulating some tokens not found)
      jest
        .spyOn(service, 'getTokenBalances')
        .mockImplementation(async (chainId, tokenAddresses, blockNumber?) => {
          if (chainId === 1) {
            // Only return balance for first token, not the second
            return {
              '0x1234567890123456789012345678901234567890':
                mockBalanceResults['0x1234567890123456789012345678901234567890'],
            } as Record<Hex, any>
          }
          return {} as Record<Hex, any>
        })

      const singleChainTokens = mockTokenConfigs.slice(0, 2) // Both Ethereum tokens
      const result = await service.getAllTokenDataForAddress(singleChainTokens)

      // Should only return the token that had a balance result
      expect(result).toHaveLength(1)
      expect(result[0].config.address).toBe('0x1234567890123456789012345678901234567890')
    })

    it('should handle chain-level errors gracefully', async () => {
      // Mock getTokenBalances to throw error for one chain but succeed for another
      jest
        .spyOn(service, 'getTokenBalances')
        .mockImplementation(async (chainId, tokenAddresses, blockNumber?) => {
          if (chainId === 1) {
            throw new Error('Chain 1 RPC failed')
          } else if (chainId === 137) {
            return mockPolygonBalanceResults
          }
          return {}
        })

      const result = await service.getAllTokenDataForAddress(mockTokenConfigs)

      // Should only return results from successful chain (137)
      expect(result).toHaveLength(1)
      expect(result[0].chainId).toBe(137)
      expect(result[0].config.address).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd')
    })

    it('should handle complete failure gracefully', async () => {
      // Mock getTokenBalances to always throw errors
      jest.spyOn(service, 'getTokenBalances').mockRejectedValue(new Error('All chains failed'))

      const result = await service.getAllTokenDataForAddress(mockTokenConfigs)

      expect(result).toEqual([])
    })

    it('should handle method-level errors and return empty array', async () => {
      // Force an error by passing invalid input that would cause groupBy to fail
      const invalidTokens = null as any

      const result = await service.getAllTokenDataForAddress(invalidTokens)

      expect(result).toEqual([])
    })

    it('should correctly group tokens by chainId', async () => {
      // Create tokens with mixed chain IDs to test grouping
      const mixedChainTokens: TokenConfig[] = [
        { ...mockTokenConfigs[0], chainId: 1 },
        { ...mockTokenConfigs[1], chainId: 137 },
        { ...mockTokenConfigs[2], chainId: 1 },
      ]

      // Mock to track which chains were called
      const getTokenBalancesSpy = jest
        .spyOn(service, 'getTokenBalances')
        .mockImplementation(async (chainId, tokenAddresses, blockNumber?) => {
          if (chainId === 1) {
            return {
              [mixedChainTokens[0].address]: mockBalanceResults[mixedChainTokens[0].address],
              [mixedChainTokens[2].address]: mockPolygonBalanceResults[mixedChainTokens[2].address],
            }
          } else if (chainId === 137) {
            return {
              [mixedChainTokens[1].address]: mockPolygonBalanceResults[mixedChainTokens[1].address],
            }
          }
          return {}
        })

      await service.getAllTokenDataForAddress(mixedChainTokens)

      // Should call getTokenBalances for each unique chain ID
      expect(getTokenBalancesSpy).toHaveBeenCalledWith(1, expect.any(Array), undefined)
      expect(getTokenBalancesSpy).toHaveBeenCalledWith(137, expect.any(Array), undefined)
      expect(getTokenBalancesSpy).toHaveBeenCalledTimes(2)
    })

    it('should preserve order and structure of results', async () => {
      const result = await service.getAllTokenDataForAddress(mockTokenConfigs)

      // Verify the structure of each result
      result.forEach((item) => {
        expect(item).toHaveProperty('config')
        expect(item).toHaveProperty('balance')
        expect(item).toHaveProperty('chainId')
        expect(item.config).toHaveProperty('address')
        expect(item.config).toHaveProperty('chainId')
        expect(item.config).toHaveProperty('minBalance')
        expect(item.config).toHaveProperty('targetBalance')
        expect(item.config).toHaveProperty('type')
        expect(item.balance).toHaveProperty('balance')
        expect(item.balance).toHaveProperty('blockNumber')
        expect(item.balance).toHaveProperty('decimals')
        expect(item.balance).toHaveProperty('blockHash')
        expect(typeof item.chainId).toBe('number')
      })
    })
  })
})
