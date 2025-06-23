import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { BalanceService } from '../services/balance.service'
import { BalanceRecordRepository } from '../repositories/balance-record.repository'
import { BalanceChangeRepository } from '../repositories/balance-change.repository'
import { RpcBalanceService } from '../services/rpc-balance.service'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'

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
      }
      const rewardAmount = BigInt('500000000000000000') // 0.5 ETH rewards

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getCurrentBalance(chainId, address)

      const expectedResult = {
        balance: BigInt('1500000000000000000'), // 1 + 0.5 ETH
        blockNumber: '18500000',
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
      }
      const rewardAmount = BigInt('200000000000000000') // 0.2 ETH rewards

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getCurrentBalance(chainId, address, blockNumber)

      const expectedResult = {
        balance: BigInt('1200000000000000000'), // 1 + 0.2 ETH
        blockNumber,
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
      }
      const rewardAmount = BigInt('1000000000000000000') // 1 ETH native rewards

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getCurrentBalance(chainId, 'native')

      const expectedResult = {
        balance: BigInt('6000000000000000000'), // 5 + 1 ETH
        blockNumber: '18500000',
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

  describe('getCurrentNativeBalance', () => {
    const chainId = 1

    it('should get native balance with rewards', async () => {
      const balanceResult = {
        balance: BigInt('5000000000000000000'),
        blockNumber: '18500200',
      }
      const rewardAmount = BigInt('500000000000000000') // 0.5 ETH native rewards

      balanceRecordRepository.getCurrentBalance.mockResolvedValue(balanceResult)
      intentSourceRepository.calculateTotalRewardsForChainAndToken.mockResolvedValue(rewardAmount)

      const result = await service.getCurrentNativeBalance(chainId)

      const expectedResult = {
        balance: BigInt('5500000000000000000'), // 5 + 0.5 ETH
        blockNumber: '18500200',
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
      address: '0x1234567890123456789012345678901234567890',
      balance: '1000000000000000000',
      blockNumber: '18500000',
      blockHash: '0xabcdef',
      timestamp: new Date('2023-10-01T12:00:00Z'),
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
      address: 'native',
      changeAmount: '1000000000000000000',
      direction: 'incoming' as const,
      blockNumber: '18500000',
      blockHash: '0xabcdef',
      transactionHash: '0x123456',
      timestamp: new Date('2023-10-01T12:00:00Z'),
      from: '0xfrom',
      to: '0xto',
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
})
