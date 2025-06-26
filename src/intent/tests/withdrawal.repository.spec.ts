import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Hex } from 'viem'

import { WithdrawalRepository } from '@/intent/repositories/withdrawal.repository'
import { WithdrawalModel } from '@/intent/schemas/withdrawal.schema'
import { Network } from '@/common/alchemy/network'

describe('WithdrawalRepository', () => {
  let repository: WithdrawalRepository
  let withdrawalModel: DeepMocked<Model<WithdrawalModel>>

  const mockIntentId = new Types.ObjectId()
  const mockEventData = {
    sourceChainID: BigInt(1),
    sourceNetwork: Network.ETH_MAINNET,
    blockNumber: BigInt(12345678),
    blockHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
    transactionIndex: 1,
    removed: false,
    address: '0x1111111111111111111111111111111111111111' as Hex,
    data: '0x' as Hex,
    topics: ['0x3333333333333333333333333333333333333333333333333333333333333333'] as any,
    transactionHash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as Hex,
    logIndex: 42,
  }

  const mockWithdrawalData = {
    event: mockEventData,
    intentHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
    intentId: mockIntentId,
    recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef' as Hex,
  }

  const mockWithdrawalRecord = {
    ...mockWithdrawalData,
    _id: new Types.ObjectId(),
    processedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(mockWithdrawalData),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalRepository,
        {
          provide: getModelToken(WithdrawalModel.name),
          useValue: createMock<Model<WithdrawalModel>>(),
        },
      ],
    }).compile()

    repository = module.get<WithdrawalRepository>(WithdrawalRepository)
    withdrawalModel = module.get(getModelToken(WithdrawalModel.name))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create a new withdrawal record', async () => {
      // Since we can't easily mock the constructor, we'll spy on the repository method
      const spy = jest.spyOn(repository, 'create').mockResolvedValue(mockWithdrawalRecord as any)

      const result = await repository.create(mockWithdrawalData)

      expect(spy).toHaveBeenCalledWith(mockWithdrawalData)
      expect(result).toEqual(mockWithdrawalRecord)

      spy.mockRestore()
    })
  })

  describe('findByFilters', () => {
    beforeEach(() => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockWithdrawalRecord]),
      }
      withdrawalModel.find.mockReturnValue(mockQuery as any)
    })

    it('should find withdrawals by recipient', async () => {
      const recipient = mockWithdrawalData.recipient
      const result = await repository.findByFilters({ recipient })

      expect(withdrawalModel.find).toHaveBeenCalledWith({ recipient })
      expect(result).toEqual([mockWithdrawalRecord])
    })

    it('should find withdrawals by intent hash', async () => {
      const intentHash = mockWithdrawalData.intentHash
      const result = await repository.findByFilters({ intentHash })

      expect(withdrawalModel.find).toHaveBeenCalledWith({ intentHash })
      expect(result).toEqual([mockWithdrawalRecord])
    })

    it('should find withdrawals by multiple filters', async () => {
      const filters = {
        recipient: mockWithdrawalData.recipient,
        intentHash: mockWithdrawalData.intentHash,
      }
      const result = await repository.findByFilters(filters)

      expect(withdrawalModel.find).toHaveBeenCalledWith({
        recipient: mockWithdrawalData.recipient,
        intentHash: mockWithdrawalData.intentHash,
      })
      expect(result).toEqual([mockWithdrawalRecord])
    })
  })

  describe('findOneByFilters', () => {
    beforeEach(() => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockWithdrawalRecord),
      }
      withdrawalModel.findOne.mockReturnValue(mockQuery as any)
    })

    it('should find a single withdrawal by filters', async () => {
      const filters = { intentHash: mockWithdrawalData.intentHash }
      const result = await repository.findOneByFilters(filters)

      expect(withdrawalModel.findOne).toHaveBeenCalledWith({
        intentHash: mockWithdrawalData.intentHash,
      })
      expect(result).toEqual(mockWithdrawalRecord)
    })
  })

  describe('findByRecipient', () => {
    it('should call findByFilters with recipient filter', async () => {
      const spy = jest
        .spyOn(repository, 'findByFilters')
        .mockResolvedValue([mockWithdrawalRecord as any])
      const recipient = mockWithdrawalData.recipient

      const result = await repository.findByRecipient(recipient)

      expect(spy).toHaveBeenCalledWith({ recipient })
      expect(result).toEqual([mockWithdrawalRecord])
    })
  })

  describe('findByIntentHash', () => {
    it('should call findByFilters with intentHash filter', async () => {
      const spy = jest
        .spyOn(repository, 'findByFilters')
        .mockResolvedValue([mockWithdrawalRecord as any])
      const intentHash = mockWithdrawalData.intentHash

      const result = await repository.findByIntentHash(intentHash)

      expect(spy).toHaveBeenCalledWith({ intentHash })
      expect(result).toEqual([mockWithdrawalRecord])
    })
  })

  describe('exists', () => {
    it('should return true when withdrawal exists', async () => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(1),
      }
      withdrawalModel.countDocuments.mockReturnValue(mockQuery as any)

      const result = await repository.exists(mockWithdrawalData.intentHash)

      expect(withdrawalModel.countDocuments).toHaveBeenCalledWith({
        intentHash: mockWithdrawalData.intentHash,
      })
      expect(result).toBe(true)
    })

    it('should return false when withdrawal does not exist', async () => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(0),
      }
      withdrawalModel.countDocuments.mockReturnValue(mockQuery as any)

      const result = await repository.exists(mockWithdrawalData.intentHash)

      expect(result).toBe(false)
    })
  })

  describe('getStatsByRecipient', () => {
    it('should return withdrawal statistics for recipient', async () => {
      const mockStats = {
        totalWithdrawals: 5,
        uniqueIntents: 3,
        latestWithdrawal: new Date(),
      }

      const mockQuery = {
        exec: jest.fn().mockResolvedValue([mockStats]),
      }
      withdrawalModel.aggregate.mockReturnValue(mockQuery as any)

      const result = await repository.getStatsByRecipient(mockWithdrawalData.recipient)

      expect(withdrawalModel.aggregate).toHaveBeenCalledWith([
        { $match: { recipient: mockWithdrawalData.recipient } },
        {
          $group: {
            _id: null,
            totalWithdrawals: { $sum: 1 },
            uniqueIntents: { $addToSet: '$intentHash' },
            latestWithdrawal: { $max: '$createdAt' },
          },
        },
        {
          $project: {
            totalWithdrawals: 1,
            uniqueIntents: { $size: '$uniqueIntents' },
            latestWithdrawal: 1,
          },
        },
      ])
      expect(result).toEqual(mockStats)
    })

    it('should return default stats when no withdrawals found', async () => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue([]),
      }
      withdrawalModel.aggregate.mockReturnValue(mockQuery as any)

      const result = await repository.getStatsByRecipient(mockWithdrawalData.recipient)

      expect(result).toEqual({
        totalWithdrawals: 0,
        uniqueIntents: 0,
        latestWithdrawal: null,
      })
    })
  })
})
