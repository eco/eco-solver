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

  const mockUSDCToken = '0xA0b86a33E6441e6f9Bf0e74E8f48dc45D07d3e9b' as Hex
  const mockDAIToken = '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Hex

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

  const mockIntentWithNativeReward = {
    ...mockIntentSourceData,
    intent: {
      ...mockIntentSourceData.intent,
      reward: {
        ...mockIntentSourceData.intent.reward,
        nativeValue: BigInt('1000000000000000000'), // 1 ETH
      },
    },
  }

  const mockIntentWithTokenReward = {
    ...mockIntentSourceData,
    intent: {
      ...mockIntentSourceData.intent,
      reward: {
        ...mockIntentSourceData.intent.reward,
        tokens: [
          {
            token: mockUSDCToken,
            amount: BigInt('1000000'), // 1 USDC (6 decimals)
          },
        ],
      },
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

  describe('findSelfFulfilledSolvedByChainAndToken', () => {
    it('should find self-fulfilled SOLVED intents for source chain and specific token', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockIntentWithTokenReward]),
      }
      intentSourceModel.find.mockReturnValue(mockQuery as any)

      const chainId = BigInt(1)
      const result = await repository.findSelfFulfilledSolvedByChainAndToken(chainId, mockUSDCToken)

      expect(intentSourceModel.find).toHaveBeenCalledWith({
        fulfilledBySelf: true,
        status: 'SOLVED',
        $or: [{ 'intent.route.source': chainId }],
        'intent.reward.tokens.token': mockUSDCToken,
      })
      expect(result).toEqual([mockIntentWithTokenReward])
    })

    it('should find self-fulfilled SOLVED intents for source chain for native token', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockIntentWithNativeReward]),
      }
      intentSourceModel.find.mockReturnValue(mockQuery as any)

      const chainId = BigInt(1)
      const result = await repository.findSelfFulfilledSolvedByChainAndToken(chainId)

      expect(intentSourceModel.find).toHaveBeenCalledWith({
        fulfilledBySelf: true,
        status: 'SOLVED',
        $or: [{ 'intent.route.source': chainId }],
        'intent.reward.nativeValue': { $gt: 0 },
      })
      expect(result).toEqual([mockIntentWithNativeReward])
    })
  })

  describe('calculateTotalRewardsForChainAndToken', () => {
    it('should calculate total token rewards for source chain and specific token', async () => {
      const mockAggregateResult = [{ totalAmount: 5000000 }] // 5 USDC
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockAggregateResult),
      }
      intentSourceModel.aggregate.mockReturnValue(mockQuery as any)

      const chainId = BigInt(1)
      const result = await repository.calculateTotalRewardsForChainAndToken(chainId, mockUSDCToken)

      expect(intentSourceModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            fulfilledBySelf: true,
            status: 'SOLVED',
            $or: [{ 'intent.route.source': chainId }],
          },
        },
        { $unwind: '$intent.reward.tokens' },
        {
          $match: {
            'intent.reward.tokens.token': mockUSDCToken,
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $toLong: '$intent.reward.tokens.amount',
              },
            },
          },
        },
      ])
      expect(result).toBe(BigInt(5000000))
    })

    it('should calculate total native rewards for source chain', async () => {
      const mockAggregateResult = [{ totalAmount: '2000000000000000000' }] // 2 ETH
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockAggregateResult),
      }
      intentSourceModel.aggregate.mockReturnValue(mockQuery as any)

      const chainId = BigInt(1)
      const result = await repository.calculateTotalRewardsForChainAndToken(chainId)

      expect(intentSourceModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            fulfilledBySelf: true,
            status: 'SOLVED',
            $or: [{ 'intent.route.source': chainId }],
            'intent.reward.nativeValue': { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $toLong: '$intent.reward.nativeValue',
              },
            },
          },
        },
      ])
      expect(result).toBe(BigInt('2000000000000000000'))
    })

    it('should only sum tokens that match the specified tokenAddress', async () => {
      const mockAggregateResult = [{ totalAmount: 3000000 }] // Only USDC tokens summed
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockAggregateResult),
      }
      intentSourceModel.aggregate.mockReturnValue(mockQuery as any)

      const chainId = BigInt(1)
      const result = await repository.calculateTotalRewardsForChainAndToken(chainId, mockUSDCToken)

      // Verify the pipeline includes the $unwind and $match stages to filter tokens
      expect(intentSourceModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            fulfilledBySelf: true,
            status: 'SOLVED',
            $or: [{ 'intent.route.source': chainId }],
          },
        },
        { $unwind: '$intent.reward.tokens' }, // This stage is crucial for token filtering
        {
          $match: {
            'intent.reward.tokens.token': mockUSDCToken, // This ensures only matching tokens are included
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $toLong: '$intent.reward.tokens.amount',
              },
            },
          },
        },
      ])
      expect(result).toBe(BigInt(3000000))
    })

    it('should filter out non-matching tokens when summing rewards', async () => {
      // Simulating a scenario where intents have mixed token rewards but we only want USDC
      const mockAggregateResult = [{ totalAmount: 2000000 }] // Only 2 USDC, DAI filtered out
      const mockQuery = {
        exec: jest.fn().mockResolvedValue(mockAggregateResult),
      }
      intentSourceModel.aggregate.mockReturnValue(mockQuery as any)

      const chainId = BigInt(1)
      const result = await repository.calculateTotalRewardsForChainAndToken(chainId, mockUSDCToken)

      // The aggregation pipeline ensures only USDC tokens are summed
      // DAI tokens in the same intent would be filtered out by the $match stage
      expect(intentSourceModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            fulfilledBySelf: true,
            status: 'SOLVED',
            $or: [{ 'intent.route.source': chainId }],
          },
        },
        { $unwind: '$intent.reward.tokens' },
        {
          $match: {
            'intent.reward.tokens.token': mockUSDCToken, // Filters out DAI and other tokens
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $toLong: '$intent.reward.tokens.amount',
              },
            },
          },
        },
      ])

      // Result should only include USDC amount (2000000), not DAI (5000000000000000000)
      expect(result).toBe(BigInt(2000000))
    })

    it('should return 0 when no matching intents exist', async () => {
      const mockQuery = {
        exec: jest.fn().mockResolvedValue([]),
      }
      intentSourceModel.aggregate.mockReturnValue(mockQuery as any)

      const chainId = BigInt(1)
      const result = await repository.calculateTotalRewardsForChainAndToken(chainId, mockUSDCToken)

      expect(result).toBe(BigInt(0))
    })
  })
})
