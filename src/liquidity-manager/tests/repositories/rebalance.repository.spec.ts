/**
 * Unit tests for RebalanceRepository
 *
 * Tests successful rebalance persistence, batch operations, and health monitoring.
 * Validates the replacement of direct model usage in LiquidityManagerService
 * with proper repository abstraction and error handling.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import {
  RebalanceRepository,
  CreateRebalanceData,
} from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceModel } from '@/liquidity-manager/schemas/rebalance.schema'
import { RebalanceTokenModel } from '@/liquidity-manager/schemas/rebalance-token.schema'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { parseUnits } from 'viem'

describe('RebalanceRepository', () => {
  let repository: RebalanceRepository
  let model: jest.Mocked<Model<RebalanceModel>>

  const mockTokenIn: RebalanceTokenModel = {
    chainId: 1,
    tokenAddress: '0x1234567890123456789012345678901234567890',
    currentBalance: 100,
    targetBalance: 200,
  }

  const mockTokenOut: RebalanceTokenModel = {
    chainId: 10,
    tokenAddress: '0x9876543210987654321098765432109876543210',
    currentBalance: 50,
    targetBalance: 150,
  }

  const mockRebalanceData: CreateRebalanceData = {
    wallet: '0x1111111111111111111111111111111111111111',
    tokenIn: mockTokenIn,
    tokenOut: mockTokenOut,
    amountIn: parseUnits('100', 6),
    amountOut: parseUnits('99', 6),
    slippage: 1,
    strategy: 'LiFi',
    groupId: 'test-group-id',
    context: { test: 'context' },
  }

  beforeEach(async () => {
    const mockModel = {
      create: jest.fn(),
      countDocuments: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RebalanceRepository,
        {
          provide: getModelToken(RebalanceModel.name),
          useValue: mockModel,
        },
      ],
    }).compile()

    repository = module.get<RebalanceRepository>(RebalanceRepository)
    model = module.get<Model<RebalanceModel>>(getModelToken(RebalanceModel.name)) as jest.Mocked<
      Model<RebalanceModel>
    >
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // Test single rebalance persistence with proper logging
  describe('create', () => {
    it('should successfully create a rebalance record', async () => {
      const mockCreatedRebalance = { _id: 'mock-id', ...mockRebalanceData }
      model.create.mockResolvedValue(mockCreatedRebalance as any)

      const result = await repository.create(mockRebalanceData)

      expect(result.response).toEqual(mockCreatedRebalance)
      expect(result.error).toBeUndefined()
      expect(model.create).toHaveBeenCalledWith(mockRebalanceData)
    })

    it('should handle creation errors gracefully', async () => {
      const mockError = new Error('Database error')
      model.create.mockRejectedValue(mockError)

      const result = await repository.create(mockRebalanceData)

      expect(result.response).toBeUndefined()
      expect(result.error).toEqual(mockError)
      expect(model.create).toHaveBeenCalledWith(mockRebalanceData)
    })

    it('should log the rebalance creation', async () => {
      const mockCreatedRebalance = { _id: 'mock-id', ...mockRebalanceData }
      model.create.mockResolvedValue(mockCreatedRebalance as any)

      const loggerSpy = jest.spyOn(repository['logger'], 'log').mockImplementation()

      await repository.create(mockRebalanceData)

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: mockRebalanceData.groupId,
          walletAddress: mockRebalanceData.wallet,
          strategy: mockRebalanceData.strategy,
          sourceChainId: mockRebalanceData.tokenIn.chainId,
          destinationChainId: mockRebalanceData.tokenOut.chainId,
          rebalanceId: 'pending',
        }),
        'Persisting successful rebalance',
        expect.objectContaining({
          token_in_chain: mockRebalanceData.tokenIn.chainId,
          token_out_chain: mockRebalanceData.tokenOut.chainId,
        }),
      )
    })
  })

  // Test batch operations that replace LiquidityManagerService.storeRebalancing
  describe('createBatch', () => {
    const mockTokenData: TokenData = {
      chainId: 1,
      config: {
        address: '0x1234567890123456789012345678901234567890',
        targetBalance: 200,
      } as any,
      balance: {
        balance: parseUnits('100', 6),
        decimals: 6,
      } as any,
    }

    const mockQuotes: RebalanceQuote[] = [
      {
        amountIn: parseUnits('100', 6),
        amountOut: parseUnits('99', 6),
        slippage: 1,
        tokenIn: mockTokenData,
        tokenOut: { ...mockTokenData, chainId: 10 },
        strategy: 'LiFi',
        context: { test: 'context1' },
      },
      {
        amountIn: parseUnits('50', 6),
        amountOut: parseUnits('49.5', 6),
        slippage: 1,
        tokenIn: mockTokenData,
        tokenOut: { ...mockTokenData, chainId: 137 },
        strategy: 'Stargate',
        context: { test: 'context2' },
      },
    ]

    it('should successfully create batch rebalances', async () => {
      const mockCreatedRebalances = mockQuotes.map((_, index) => ({ _id: `mock-id-${index}` }))
      model.create.mockResolvedValueOnce(mockCreatedRebalances[0] as any)
      model.create.mockResolvedValueOnce(mockCreatedRebalances[1] as any)

      jest
        .spyOn(repository, 'create')
        .mockResolvedValueOnce({ response: mockCreatedRebalances[0] as any })
        .mockResolvedValueOnce({ response: mockCreatedRebalances[1] as any })

      const result = await repository.createBatch(
        '0x1111111111111111111111111111111111111111',
        mockQuotes,
      )

      expect(result.response).toHaveLength(2)
      expect(result.error).toBeUndefined()
      expect(repository.create).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures in batch creation', async () => {
      jest
        .spyOn(repository, 'create')
        .mockResolvedValueOnce({ response: { _id: 'success' } as any })
        .mockResolvedValueOnce({ error: new Error('Failed') })

      const result = await repository.createBatch(
        '0x1111111111111111111111111111111111111111',
        mockQuotes,
      )

      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toContain('1 out of 2 rebalances failed to persist')
    })

    it('should use provided groupId', async () => {
      const customGroupId = 'custom-group-id'
      jest.spyOn(repository, 'create').mockResolvedValue({ response: { _id: 'mock-id' } as any })

      await repository.createBatch(
        '0x1111111111111111111111111111111111111111',
        [mockQuotes[0]],
        customGroupId,
      )

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: customGroupId,
        }),
      )
    })

    it('should generate groupId if not provided', async () => {
      jest.spyOn(repository, 'create').mockResolvedValue({ response: { _id: 'mock-id' } as any })

      await repository.createBatch('0x1111111111111111111111111111111111111111', [mockQuotes[0]])

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: expect.any(String),
        }),
      )
    })
  })

  // Test health monitoring for successful rebalance tracking
  describe('hasSuccessfulRebalancesInLastHour', () => {
    it('should return true when successful rebalances exist in last hour', async () => {
      model.countDocuments.mockResolvedValue(3)

      const result = await repository.hasSuccessfulRebalancesInLastHour()

      expect(result).toBe(true)
      expect(model.countDocuments).toHaveBeenCalledWith({
        createdAt: { $gte: expect.any(Date) },
      })
    })

    it('should return false when no successful rebalances exist in last hour', async () => {
      model.countDocuments.mockResolvedValue(0)

      const result = await repository.hasSuccessfulRebalancesInLastHour()

      expect(result).toBe(false)
    })

    it('should return false on database error', async () => {
      model.countDocuments.mockRejectedValue(new Error('Database error'))

      const result = await repository.hasSuccessfulRebalancesInLastHour()

      expect(result).toBe(false)
    })
  })

  // Test configurable analytics queries for success metrics
  describe('getRecentSuccessCount', () => {
    it('should return count for default 60 minutes', async () => {
      model.countDocuments.mockResolvedValue(5)

      const result = await repository.getRecentSuccessCount()

      expect(result).toBe(5)
      expect(model.countDocuments).toHaveBeenCalledWith({
        createdAt: { $gte: expect.any(Date) },
      })
    })

    it('should return count for custom time range', async () => {
      model.countDocuments.mockResolvedValue(10)

      const result = await repository.getRecentSuccessCount(30)

      expect(result).toBe(10)
    })

    it('should return 0 on database error', async () => {
      model.countDocuments.mockRejectedValue(new Error('Database error'))

      const result = await repository.getRecentSuccessCount(60)

      expect(result).toBe(0)
    })
  })
})
