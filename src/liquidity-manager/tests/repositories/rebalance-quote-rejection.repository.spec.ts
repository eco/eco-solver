/**
 * Unit tests for RebalanceQuoteRejectionRepository
 *
 * Tests comprehensive CRUD operations, error handling, and health monitoring
 * functionality for rejected rebalance quotes persistence. Covers all
 * rejection reasons and validates non-blocking behavior on database failures.
 */
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import {
  RebalanceQuoteRejectionRepository,
  CreateRejectionData,
} from '@/liquidity-manager/repositories/rebalance-quote-rejection.repository'
import {
  RebalanceQuoteRejectionModel,
  RejectionReason,
} from '@/liquidity-manager/schemas/rebalance-quote-rejection.schema'
import { RebalanceTokenModel } from '@/liquidity-manager/schemas/rebalance-token.schema'

describe('RebalanceQuoteRejectionRepository', () => {
  let repository: RebalanceQuoteRejectionRepository
  let model: jest.Mocked<Model<RebalanceQuoteRejectionModel>>

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

  const mockRejectionData: CreateRejectionData = {
    rebalanceId: 'test-rebalance-id',
    strategy: 'LiFi',
    reason: RejectionReason.HIGH_SLIPPAGE,
    tokenIn: mockTokenIn,
    tokenOut: mockTokenOut,
    swapAmount: 100,
    details: { slippage: 15 },
    walletAddress: '0x1111111111111111111111111111111111111111',
  }

  beforeEach(async () => {
    const mockModel = {
      create: jest.fn(),
      countDocuments: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RebalanceQuoteRejectionRepository,
        {
          provide: getModelToken(RebalanceQuoteRejectionModel.name),
          useValue: mockModel,
        },
      ],
    }).compile()

    repository = module.get<RebalanceQuoteRejectionRepository>(RebalanceQuoteRejectionRepository)
    model = module.get<Model<RebalanceQuoteRejectionModel>>(
      getModelToken(RebalanceQuoteRejectionModel.name),
    ) as jest.Mocked<Model<RebalanceQuoteRejectionModel>>
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // Test core persistence functionality with comprehensive error handling
  describe('create', () => {
    it('should successfully create a rejection record', async () => {
      const mockCreatedRejection = { _id: 'mock-id', ...mockRejectionData }
      model.create.mockResolvedValue(mockCreatedRejection as any)

      const result = await repository.create(mockRejectionData)

      expect(result.response).toEqual(mockCreatedRejection)
      expect(result.error).toBeUndefined()
      expect(model.create).toHaveBeenCalledWith(mockRejectionData)
    })

    it('should handle creation errors gracefully', async () => {
      const mockError = new Error('Database error')
      model.create.mockRejectedValue(mockError)

      const result = await repository.create(mockRejectionData)

      expect(result.response).toBeUndefined()
      expect(result.error).toEqual(mockError)
      expect(model.create).toHaveBeenCalledWith(mockRejectionData)
    })

    it('should log the rejection creation', async () => {
      const mockCreatedRejection = { _id: 'mock-id', ...mockRejectionData }
      model.create.mockResolvedValue(mockCreatedRejection as any)

      const loggerSpy = jest.spyOn(repository['logger'], 'log').mockImplementation()

      await repository.create(mockRejectionData)

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          rebalanceId: mockRejectionData.rebalanceId,
          walletAddress: mockRejectionData.walletAddress,
          strategy: mockRejectionData.strategy,
          sourceChainId: mockRejectionData.tokenIn.chainId,
          destinationChainId: mockRejectionData.tokenOut.chainId,
        }),
        'Persisting quote rejection',
        expect.objectContaining({
          reason: mockRejectionData.reason,
          tokenInChain: mockRejectionData.tokenIn.chainId,
          tokenOutChain: mockRejectionData.tokenOut.chainId,
        }),
      )
    })
  })

  // Test health monitoring functionality for system status determination
  describe('hasRejectionsInLastHour', () => {
    it('should return true when rejections exist in last hour', async () => {
      model.countDocuments.mockResolvedValue(5)

      const result = await repository.hasRejectionsInLastHour()

      expect(result).toBe(true)
      expect(model.countDocuments).toHaveBeenCalledWith({
        createdAt: { $gte: expect.any(Date) },
      })
    })

    it('should return false when no rejections exist in last hour', async () => {
      model.countDocuments.mockResolvedValue(0)

      const result = await repository.hasRejectionsInLastHour()

      expect(result).toBe(false)
    })

    it('should return false on database error', async () => {
      model.countDocuments.mockRejectedValue(new Error('Database error'))

      const result = await repository.hasRejectionsInLastHour()

      expect(result).toBe(false)
    })
  })

  // Test flexible time-based analytics queries
  describe('getRecentRejectionCount', () => {
    it('should return count for default 60 minutes', async () => {
      model.countDocuments.mockResolvedValue(3)

      const result = await repository.getRecentRejectionCount()

      expect(result).toBe(3)
      expect(model.countDocuments).toHaveBeenCalledWith({
        createdAt: { $gte: expect.any(Date) },
      })
    })

    it('should return count for custom time range', async () => {
      model.countDocuments.mockResolvedValue(7)

      const result = await repository.getRecentRejectionCount(30)

      expect(result).toBe(7)
    })

    it('should return 0 on database error', async () => {
      model.countDocuments.mockRejectedValue(new Error('Database error'))

      const result = await repository.getRecentRejectionCount(60)

      expect(result).toBe(0)
    })
  })

  // Test enum validation to ensure all rejection reasons are supported
  describe('RejectionReason enum validation', () => {
    it('should accept all valid rejection reasons', async () => {
      const reasons = [
        RejectionReason.HIGH_SLIPPAGE,
        RejectionReason.PROVIDER_ERROR,
        RejectionReason.INSUFFICIENT_LIQUIDITY,
        RejectionReason.TIMEOUT,
      ]

      model.create.mockResolvedValue({ _id: 'mock-id' } as any)

      for (const reason of reasons) {
        const data = { ...mockRejectionData, reason }
        await repository.create(data)
        expect(model.create).toHaveBeenCalledWith(data)
      }

      expect(model.create).toHaveBeenCalledTimes(reasons.length)
    })
  })
})
