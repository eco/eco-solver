import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Model } from 'mongoose'
import { Hex } from 'viem'
import { BalanceChangeRepository } from '@/balance/repositories/balance-change.repository'
import { BalanceChange, BalanceChangeModel } from '@/balance/schemas/balance-change.schema'

describe('BalanceChangeRepository', () => {
  let repository: BalanceChangeRepository
  let mockBalanceChangeModel: any

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceChangeRepository,
        {
          provide: getModelToken(BalanceChange.name),
          useValue: jest.fn().mockImplementation((data) => ({
            ...data,
            save: jest.fn().mockResolvedValue({ ...data, _id: 'mockId' }),
          })),
        },
      ],
    }).compile()

    repository = module.get<BalanceChangeRepository>(BalanceChangeRepository)
    mockBalanceChangeModel = module.get(getModelToken(BalanceChange.name))

    // Setup aggregate mock
    mockBalanceChangeModel.aggregate = jest.fn().mockReturnValue({
      exec: jest.fn(),
    })

    // Setup find mock
    mockBalanceChangeModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        exec: jest.fn(),
      }),
    })

    jest.clearAllMocks()

    // Reset the mock implementation to default
    mockBalanceChangeModel.mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockResolvedValue({ ...data, _id: 'mockId' }),
    }))
  })

  describe('calculateOutstandingBalance', () => {
    const chainId = '1'
    const address = '0x1234567890123456789012345678901234567890' as Hex
    const blockNumber = '18500000'

    it('should calculate outstanding balance with incoming and outgoing transfers', async () => {
      const aggregateResult = [
        {
          outstandingBalance: 500000000000000000, // +0.5 ETH net (incoming - outgoing)
        },
      ]

      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      } as any)

      const result = await repository.calculateOutstandingBalance(chainId, address, blockNumber)

      expect(result.toString()).toBe('500000000000000000')
      expect(mockBalanceChangeModel.aggregate).toHaveBeenCalledWith([
        {
          $match: {
            chainId,
            address,
            blockNumber: { $gte: blockNumber },
          },
        },
        {
          $group: {
            _id: null,
            totalIncoming: {
              $sum: {
                $cond: [{ $eq: ['$direction', 'incoming'] }, { $toLong: '$changeAmount' }, 0],
              },
            },
            totalOutgoing: {
              $sum: {
                $cond: [{ $eq: ['$direction', 'outgoing'] }, { $toLong: '$changeAmount' }, 0],
              },
            },
          },
        },
        {
          $project: {
            outstandingBalance: { $subtract: ['$totalIncoming', '$totalOutgoing'] },
          },
        },
      ])
    })

    it('should return zero when no balance changes found', async () => {
      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      } as any)

      const result = await repository.calculateOutstandingBalance(chainId, address, blockNumber)

      expect(result.toString()).toBe('0')
    })

    it('should handle negative outstanding balance (more outgoing than incoming)', async () => {
      const aggregateResult = [
        {
          outstandingBalance: -300000000000000000, // -0.3 ETH net
        },
      ]

      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      } as any)

      const result = await repository.calculateOutstandingBalance(chainId, address, blockNumber)

      expect(result.toString()).toBe('-300000000000000000')
    })

    it('should handle large outstanding balances correctly', async () => {
      const aggregateResult = [
        {
          outstandingBalance: 999999999999999999999999, // Very large positive balance
        },
      ]

      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      } as any)

      const result = await repository.calculateOutstandingBalance(chainId, address, blockNumber)

      expect(result.toString()).toBe('999999999999999983222784')
    })

    it('should handle null outstanding balance result', async () => {
      const aggregateResult = [
        {
          outstandingBalance: null,
        },
      ]

      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      } as any)

      const result = await repository.calculateOutstandingBalance(chainId, address, blockNumber)

      expect(result.toString()).toBe('0')
    })

    it('should filter changes from specific block number correctly', async () => {
      const specificBlockNumber = '18500050'
      const aggregateResult = [{ outstandingBalance: 1000000000000000000 }]

      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      } as any)

      await repository.calculateOutstandingBalance(chainId, address, specificBlockNumber)

      expect(mockBalanceChangeModel.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: {
              chainId,
              address,
              blockNumber: { $gte: specificBlockNumber },
            },
          }),
        ]),
      )
    })
  })

  describe('createBalanceChange', () => {
    const changeParams = {
      chainId: '1',
      address: 'native' as const,
      changeAmount: '1000000000000000000',
      direction: 'incoming' as const,
      blockNumber: '18500000',
      blockHash: '0xabcdef',
      transactionHash: '0x123456',
      from: '0xfrom',
      to: '0xto',
    }

    it('should create a balance change record', async () => {
      const result = await repository.createBalanceChange(changeParams)

      expect(result).toEqual(expect.objectContaining(changeParams))
      expect(mockBalanceChangeModel).toHaveBeenCalledWith(changeParams)
    })

    it('should handle different directions correctly', async () => {
      const outgoingParams = {
        ...changeParams,
        direction: 'outgoing' as const,
      }

      const result = await repository.createBalanceChange(outgoingParams)

      expect(result).toEqual(expect.objectContaining(outgoingParams))
      expect(mockBalanceChangeModel).toHaveBeenCalledWith(outgoingParams)
    })
  })

  describe('getBalanceChangesSince', () => {
    const chainId = '1'
    const address = '0x1234567890123456789012345678901234567890' as Hex
    const blockNumber = '18500000'

    it('should fetch balance changes since specified block', async () => {
      const mockChanges = [
        {
          chainId,
          address,
          changeAmount: '1000000000000000000',
          direction: 'incoming',
          blockNumber: '18500001',
        },
        {
          chainId,
          address,
          changeAmount: '500000000000000000',
          direction: 'outgoing',
          blockNumber: '18500002',
        },
      ] as BalanceChangeModel[]

      mockBalanceChangeModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockChanges),
        }),
      } as any)

      const result = await repository.getBalanceChangesSince(chainId, address, blockNumber)

      expect(result).toEqual(mockChanges)
      expect(mockBalanceChangeModel.find).toHaveBeenCalledWith({
        chainId,
        address,
        blockNumber: { $gte: blockNumber },
      })
    })

    it('should return empty array when no changes found', async () => {
      mockBalanceChangeModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      } as any)

      const result = await repository.getBalanceChangesSince(chainId, address, blockNumber)

      expect(result).toEqual([])
    })
  })

  describe('create', () => {
    const createParams = {
      chainId: '1',
      address: 'native' as const,
      changeAmount: '1000000000000000000',
      direction: 'incoming' as const,
      blockNumber: '18500000',
      blockHash: '0xabcdef',
      transactionHash: '0x123456',
      from: '0xfrom',
      to: '0xto',
    }

    it('should create a balance change with string conversion', async () => {
      const result = await repository.create(createParams)

      expect(result).toEqual(
        expect.objectContaining({
          chainId: '1',
          changeAmount: '1000000000000000000',
          blockNumber: '18500000',
        }),
      )
      expect(mockBalanceChangeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: '1',
          changeAmount: '1000000000000000000',
          blockNumber: '18500000',
        }),
      )
    })

    it('should handle duplicate key errors gracefully', async () => {
      const duplicateError = { code: 11000 }

      // Override the default mock for this test to throw on save
      mockBalanceChangeModel.mockImplementationOnce((data) => ({
        ...data,
        save: jest.fn().mockImplementation(() => {
          throw duplicateError
        }),
      }))

      const result = await repository.create(createParams)

      expect(result).toBeNull()
    })

    it('should propagate non-duplicate errors', async () => {
      const otherError = new Error('Database connection failed')

      // Override the default mock for this test to throw on save
      mockBalanceChangeModel.mockImplementationOnce((data) => ({
        ...data,
        save: jest.fn().mockImplementation(() => {
          throw otherError
        }),
      }))

      await expect(repository.create(createParams)).rejects.toThrow(otherError)
    })
  })

  describe('integration scenarios for outstanding balance calculation', () => {
    const chainId = '1'
    const address = 'native' as const
    const baseBlockNumber = '18500000'

    it('should demonstrate complex outstanding balance scenarios', async () => {
      // Scenario: Multiple transfers after last RPC update
      // Block 18500000: RPC balance recorded
      // Block 18500001: +2 ETH incoming
      // Block 18500002: -0.5 ETH outgoing
      // Block 18500003: +1 ETH incoming
      // Block 18500004: -0.3 ETH outgoing
      // Net outstanding: +2.2 ETH

      const aggregateResult = [
        {
          // MongoDB aggregation would calculate this
          outstandingBalance: 2200000000000000000, // +2.2 ETH net
        },
      ]

      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      } as any)

      const result = await repository.calculateOutstandingBalance(chainId, address, baseBlockNumber)

      expect(result.toString()).toBe('2200000000000000000')

      // Verify the aggregation pipeline structure
      const aggregationCall = (mockBalanceChangeModel.aggregate as jest.Mock).mock.calls[0][0]

      // Should match records from the base block number onwards
      expect(aggregationCall[0].$match).toEqual({
        chainId,
        address,
        blockNumber: { $gte: baseBlockNumber },
      })

      // Should group by incoming/outgoing and calculate net difference
      expect(aggregationCall[1].$group).toHaveProperty('totalIncoming')
      expect(aggregationCall[1].$group).toHaveProperty('totalOutgoing')
      expect(aggregationCall[2].$project.outstandingBalance).toEqual({
        $subtract: ['$totalIncoming', '$totalOutgoing'],
      })
    })

    it('should handle only incoming transfers', async () => {
      const aggregateResult = [
        {
          outstandingBalance: 3000000000000000000, // +3 ETH (only incoming, no outgoing)
        },
      ]

      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      } as any)

      const result = await repository.calculateOutstandingBalance(chainId, address, baseBlockNumber)

      expect(result.toString()).toBe('3000000000000000000')
    })

    it('should handle only outgoing transfers', async () => {
      const aggregateResult = [
        {
          outstandingBalance: -1500000000000000000, // -1.5 ETH (only outgoing, no incoming)
        },
      ]

      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      } as any)

      const result = await repository.calculateOutstandingBalance(chainId, address, baseBlockNumber)

      expect(result.toString()).toBe('-1500000000000000000')
    })

    it('should handle equal incoming and outgoing transfers', async () => {
      const aggregateResult = [
        {
          outstandingBalance: 0, // Equal incoming and outgoing
        },
      ]

      mockBalanceChangeModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(aggregateResult),
      } as any)

      const result = await repository.calculateOutstandingBalance(chainId, address, baseBlockNumber)

      expect(result.toString()).toBe('0')
    })
  })
})
