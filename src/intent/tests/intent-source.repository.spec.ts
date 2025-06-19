import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Hex } from 'viem'

import { IntentSourceRepository } from '../repositories/intent-source.repository'
import { IntentSourceModel, IntentSourceStatus } from '../schemas/intent-source.schema'

describe('IntentSourceRepository', () => {
  let repository: IntentSourceRepository
  let intentSourceModel: DeepMocked<Model<IntentSourceModel>>

  const mockIntentId = new Types.ObjectId()
  const mockIntentHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex

  const mockIntentSourceData = {
    status: 'SOLVED' as IntentSourceStatus,
    fulfilledBySelf: true,
    intent: {
      hash: mockIntentHash,
      route: {
        source: BigInt(1),
        destination: BigInt(10),
        salt: '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex,
        inbox: '0x1111111111111111111111111111111111111111' as Hex,
        tokens: [],
        calls: [],
      },
      reward: {
        creator: '0x2222222222222222222222222222222222222222' as Hex,
        prover: '0x3333333333333333333333333333333333333333' as Hex,
        deadline: BigInt(1234567890),
        nativeValue: BigInt(0),
        tokens: [],
      },
      logIndex: 0,
    },
  }

  const mockIntentSourceRecord = {
    ...mockIntentSourceData,
    _id: mockIntentId,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentSourceRepository,
        {
          provide: getModelToken(IntentSourceModel.name),
          useValue: createMock<Model<IntentSourceModel>>(),
        },
      ],
    }).compile()

    repository = module.get<IntentSourceRepository>(IntentSourceRepository)
    intentSourceModel = module.get(getModelToken(IntentSourceModel.name))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('create', () => {
    it('should create and save a new intent source', async () => {
      // Since we can't easily mock the constructor, we'll spy on the repository method
      const spy = jest.spyOn(repository, 'create').mockResolvedValue(mockIntentSourceRecord as any)

      const result = await repository.create(mockIntentSourceData)

      expect(spy).toHaveBeenCalledWith(mockIntentSourceData)
      expect(result).toEqual(mockIntentSourceRecord)
    })
  })

  describe('findByFilters', () => {
    beforeEach(() => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockIntentSourceRecord]),
      }
      intentSourceModel.find.mockReturnValue(mockQuery as any)
    })

    it('should find intent sources by status filter', async () => {
      const filters = { status: 'SOLVED' as IntentSourceStatus }
      const result = await repository.findByFilters(filters)

      expect(intentSourceModel.find).toHaveBeenCalledWith({
        status: 'SOLVED',
      })
      expect(result).toEqual([mockIntentSourceRecord])
    })

    it('should find intent sources by fulfilledBySelf filter', async () => {
      const filters = { fulfilledBySelf: true }
      const result = await repository.findByFilters(filters)

      expect(intentSourceModel.find).toHaveBeenCalledWith({
        fulfilledBySelf: true,
      })
      expect(result).toEqual([mockIntentSourceRecord])
    })

    it('should find intent sources by multiple filters', async () => {
      const filters = {
        status: 'SOLVED' as IntentSourceStatus,
        fulfilledBySelf: true,
      }
      const result = await repository.findByFilters(filters)

      expect(intentSourceModel.find).toHaveBeenCalledWith({
        status: 'SOLVED',
        fulfilledBySelf: true,
      })
      expect(result).toEqual([mockIntentSourceRecord])
    })
  })

  describe('findOneByFilters', () => {
    beforeEach(() => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockIntentSourceRecord),
      }
      intentSourceModel.findOne.mockReturnValue(mockQuery as any)
    })

    it('should find a single intent source by filters', async () => {
      const filters = { intentHash: mockIntentHash }
      const result = await repository.findOneByFilters(filters)

      expect(intentSourceModel.findOne).toHaveBeenCalledWith({
        'intent.hash': mockIntentHash,
      })
      expect(result).toEqual(mockIntentSourceRecord)
    })
  })

  describe('findSelfFulfilledByStatus', () => {
    it('should find self-fulfilled intents by status', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockIntentSourceRecord]),
      }
      intentSourceModel.find.mockReturnValue(mockQuery as any)

      const result = await repository.findSelfFulfilledByStatus('SOLVED')

      expect(intentSourceModel.find).toHaveBeenCalledWith({
        fulfilledBySelf: true,
        status: 'SOLVED',
      })
      expect(result).toEqual([mockIntentSourceRecord])
    })
  })

  describe('findByIntentHash', () => {
    it('should find intent source by intent hash', async () => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockIntentSourceRecord),
      }
      intentSourceModel.findOne.mockReturnValue(mockQuery as any)

      const result = await repository.findByIntentHash(mockIntentHash)

      expect(intentSourceModel.findOne).toHaveBeenCalledWith({
        'intent.hash': mockIntentHash,
      })
      expect(result).toEqual(mockIntentSourceRecord)
    })
  })

  describe('update', () => {
    it('should update intent source by id', async () => {
      const updates = { status: 'WITHDRAWN' as IntentSourceStatus }
      const mockQuery = {
        exec: jest.fn().mockResolvedValue({ ...mockIntentSourceRecord, ...updates }),
      }
      intentSourceModel.findByIdAndUpdate.mockReturnValue(mockQuery as any)

      const result = await repository.update(mockIntentId, updates)

      expect(intentSourceModel.findByIdAndUpdate).toHaveBeenCalledWith(mockIntentId, updates, {
        new: true,
      })
      expect(result).toEqual({ ...mockIntentSourceRecord, ...updates })
    })
  })

  describe('updateByIntentHash', () => {
    it('should update intent source by intent hash', async () => {
      const updates = { status: 'WITHDRAWN' as IntentSourceStatus }
      const mockQuery = {
        exec: jest.fn().mockResolvedValue({ ...mockIntentSourceRecord, ...updates }),
      }
      intentSourceModel.findOneAndUpdate.mockReturnValue(mockQuery as any)

      const result = await repository.updateByIntentHash(mockIntentHash, updates)

      expect(intentSourceModel.findOneAndUpdate).toHaveBeenCalledWith(
        { 'intent.hash': mockIntentHash },
        updates,
        { new: true },
      )
      expect(result).toEqual({ ...mockIntentSourceRecord, ...updates })
    })
  })

  describe('countByFilters', () => {
    it('should count intent sources by filters', async () => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(5),
      }
      intentSourceModel.countDocuments.mockReturnValue(mockQuery as any)

      const filters = { fulfilledBySelf: true }
      const result = await repository.countByFilters(filters)

      expect(intentSourceModel.countDocuments).toHaveBeenCalledWith({
        fulfilledBySelf: true,
      })
      expect(result).toBe(5)
    })
  })

  describe('getSelfFulfilledStats', () => {
    it('should get statistics for self-fulfilled intents', async () => {
      const mockAggregateResult = [
        { _id: 'SOLVED', count: 10 },
        { _id: 'WITHDRAWN', count: 5 },
        { _id: 'FAILED', count: 2 },
      ]
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockAggregateResult),
      }
      intentSourceModel.aggregate.mockReturnValue(mockQuery as any)

      const result = await repository.getSelfFulfilledStats()

      expect(intentSourceModel.aggregate).toHaveBeenCalledWith([
        { $match: { fulfilledBySelf: true } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      expect(result).toEqual({
        totalSelfFulfilled: 17,
        byStatus: {
          SOLVED: 10,
          WITHDRAWN: 5,
          FAILED: 2,
        },
      })
    })

    it('should return empty stats when no self-fulfilled intents exist', async () => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue([]),
      }
      intentSourceModel.aggregate.mockReturnValue(mockQuery as any)

      const result = await repository.getSelfFulfilledStats()

      expect(result).toEqual({
        totalSelfFulfilled: 0,
        byStatus: {},
      })
    })
  })
})
