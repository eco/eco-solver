import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Model } from 'mongoose'
import { Hex } from 'viem'
import { BalanceRecordRepository } from '@/balance/repositories/balance-record.repository'
import { BalanceChangeRepository } from '@/balance/repositories/balance-change.repository'
import { BalanceRecord, BalanceRecordModel } from '@/balance/schemas/balance-record.schema'

describe('BalanceRecordRepository', () => {
  let repository: BalanceRecordRepository
  let mockBalanceRecordModel: DeepMocked<Model<BalanceRecordModel>>
  let mockBalanceChangeRepository: DeepMocked<BalanceChangeRepository>

  const mockBalanceRecord = {
    chainId: '1',
    address: '0x1234567890123456789012345678901234567890' as Hex,
    balance: '1000000000000000000',
    blockNumber: '18500000',
    blockHash: '0xabcdef123456',
    decimals: 18,
    tokenSymbol: 'TEST',
    tokenName: 'Test Token',
  } as BalanceRecordModel

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceRecordRepository,
        {
          provide: getModelToken(BalanceRecord.name),
          useValue: createMock<Model<BalanceRecordModel>>(),
        },
        {
          provide: BalanceChangeRepository,
          useValue: createMock<BalanceChangeRepository>(),
        },
      ],
    }).compile()

    repository = module.get<BalanceRecordRepository>(BalanceRecordRepository)
    mockBalanceRecordModel = module.get(getModelToken(BalanceRecord.name))
    mockBalanceChangeRepository = module.get(BalanceChangeRepository)

    jest.clearAllMocks()
  })

  describe('getCurrentBalance', () => {
    const chainId = '1'
    const address = '0x1234567890123456789012345678901234567890' as Hex

    it('should aggregate base balance with outstanding changes correctly', async () => {
      const baseBalance = BigInt('1000000000000000000') // 1 ETH
      const outstandingChanges = BigInt('500000000000000000') // +0.5 ETH from transfers
      const blockNumber = '18500000'

      // Mock finding the balance record
      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBalanceRecord,
          balance: baseBalance.toString(),
          blockNumber,
        }),
      } as any)

      // Mock calculating outstanding balance changes
      mockBalanceChangeRepository.calculateOutstandingBalance.mockResolvedValue(outstandingChanges)

      const result = await repository.getCurrentBalance(chainId, address)

      expect(result).toEqual({
        balance: baseBalance + outstandingChanges, // 1.5 ETH total
        blockNumber,
        blockHash: mockBalanceRecord.blockHash,
        decimals: 18,
      })

      expect(mockBalanceRecordModel.findOne).toHaveBeenCalledWith({
        chainId,
        address,
      })
      expect(mockBalanceChangeRepository.calculateOutstandingBalance).toHaveBeenCalledWith(
        chainId,
        address,
        blockNumber, // Uses balance record's block number as default
      )
    })

    it('should use specified block number for aggregation', async () => {
      const specifiedBlockNumber = '18500100'
      const baseBalance = BigInt('2000000000000000000') // 2 ETH
      const outstandingChanges = BigInt('-300000000000000000') // -0.3 ETH (net outgoing)

      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBalanceRecord,
          balance: baseBalance.toString(),
          blockNumber: '18500000', // Different from specified block
        }),
      } as any)

      mockBalanceChangeRepository.calculateOutstandingBalance.mockResolvedValue(outstandingChanges)

      const result = await repository.getCurrentBalance(chainId, address, specifiedBlockNumber)

      expect(result).toEqual({
        balance: baseBalance + outstandingChanges, // 1.7 ETH total
        blockNumber: specifiedBlockNumber,
        blockHash: mockBalanceRecord.blockHash,
        decimals: 18,
      })

      // Should use the specified block number for outstanding changes calculation
      expect(mockBalanceChangeRepository.calculateOutstandingBalance).toHaveBeenCalledWith(
        chainId,
        address,
        specifiedBlockNumber,
      )
    })

    it('should handle zero outstanding changes', async () => {
      const baseBalance = BigInt('1000000000000000000')
      const zeroChanges = BigInt('0')

      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBalanceRecord,
          balance: baseBalance.toString(),
        }),
      } as any)

      mockBalanceChangeRepository.calculateOutstandingBalance.mockResolvedValue(zeroChanges)

      const result = await repository.getCurrentBalance(chainId, address)

      expect(result).toEqual({
        balance: baseBalance, // No changes, just base balance
        blockNumber: mockBalanceRecord.blockNumber,
        blockHash: mockBalanceRecord.blockHash,
        decimals: 18,
      })
    })

    it('should return null when no balance record exists', async () => {
      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any)

      const result = await repository.getCurrentBalance(chainId, address)

      expect(result).toBeNull()
      expect(mockBalanceChangeRepository.calculateOutstandingBalance).not.toHaveBeenCalled()
    })

    it('should handle large balance values correctly', async () => {
      const largeBaseBalance = BigInt('999999999999999999999999')
      const largeOutstandingChanges = BigInt('111111111111111111111111')

      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBalanceRecord,
          balance: largeBaseBalance.toString(),
        }),
      } as any)

      mockBalanceChangeRepository.calculateOutstandingBalance.mockResolvedValue(
        largeOutstandingChanges,
      )

      const result = await repository.getCurrentBalance(chainId, address)

      const expectedTotal = largeBaseBalance + largeOutstandingChanges
      expect(result).toEqual({
        balance: expectedTotal,
        blockNumber: mockBalanceRecord.blockNumber,
        blockHash: mockBalanceRecord.blockHash,
        decimals: 18,
      })
      expect(result!.balance.toString()).toBe('1111111111111111111111110')
    })

    it('should handle negative outstanding changes correctly', async () => {
      const baseBalance = BigInt('2000000000000000000') // 2 ETH
      const negativeOutstandingChanges = BigInt('-1500000000000000000') // -1.5 ETH

      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBalanceRecord,
          balance: baseBalance.toString(),
        }),
      } as any)

      mockBalanceChangeRepository.calculateOutstandingBalance.mockResolvedValue(
        negativeOutstandingChanges,
      )

      const result = await repository.getCurrentBalance(chainId, address)

      expect(result).toEqual({
        balance: BigInt('500000000000000000'), // 2 - 1.5 = 0.5 ETH
        blockNumber: mockBalanceRecord.blockNumber,
        blockHash: mockBalanceRecord.blockHash,
        decimals: 18,
      })
    })

    it('should handle native token addresses correctly', async () => {
      const nativeAddress = 'native'
      const nativeBalance = BigInt('5000000000000000000') // 5 ETH
      const nativeChanges = BigInt('1000000000000000000') // +1 ETH

      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockBalanceRecord,
          address: nativeAddress,
          balance: nativeBalance.toString(),
        }),
      } as any)

      mockBalanceChangeRepository.calculateOutstandingBalance.mockResolvedValue(nativeChanges)

      const result = await repository.getCurrentBalance(chainId, nativeAddress)

      expect(result).toEqual({
        balance: nativeBalance + nativeChanges, // 6 ETH total
        blockNumber: mockBalanceRecord.blockNumber,
        blockHash: mockBalanceRecord.blockHash,
        decimals: 18,
      })

      expect(mockBalanceRecordModel.findOne).toHaveBeenCalledWith({
        chainId,
        address: nativeAddress,
      })
    })
  })

  describe('updateFromRpc', () => {
    const updateParams = {
      chainId: '1',
      address: '0x1234567890123456789012345678901234567890' as Hex,
      balance: '2000000000000000000',
      blockNumber: '18500100',
      blockHash: '0xnewblockhash',
      decimals: 18,
      tokenSymbol: 'TEST',
      tokenName: 'Test Token',
    }

    it('should update balance when new block number is greater', async () => {
      const updatedRecord = { ...mockBalanceRecord, ...updateParams }

      mockBalanceRecordModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedRecord),
      } as any)

      const result = await repository.updateFromRpc(updateParams)

      expect(result).toEqual(updatedRecord)
      expect(mockBalanceRecordModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          chainId: updateParams.chainId,
          address: updateParams.address,
          $or: [
            { blockNumber: { $exists: false } },
            { blockNumber: { $lt: updateParams.blockNumber } },
          ],
        },
        {
          balance: updateParams.balance,
          blockNumber: updateParams.blockNumber,
          blockHash: updateParams.blockHash,
          decimals: updateParams.decimals,
          tokenSymbol: updateParams.tokenSymbol,
          tokenName: updateParams.tokenName,
        },
        { new: true },
      )
    })

    it('should not update when block number is not greater', async () => {
      const existingRecord = {
        ...mockBalanceRecord,
        blockNumber: '18500200', // Higher than update params
      }

      // First findOneAndUpdate returns null (no update made)
      mockBalanceRecordModel.findOneAndUpdate.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      } as any)

      // findOne returns existing record to show why update was skipped
      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingRecord),
      } as any)

      const result = await repository.updateFromRpc(updateParams)

      expect(result).toEqual(existingRecord)
      expect(mockBalanceRecordModel.findOne).toHaveBeenCalledWith({
        chainId: updateParams.chainId,
        address: updateParams.address,
      })
    })

    it('should create new record if none exists', async () => {
      const newRecord = { ...mockBalanceRecord, ...updateParams }

      // First findOneAndUpdate returns null (no update made)
      mockBalanceRecordModel.findOneAndUpdate
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(null),
        } as any)
        // Second findOneAndUpdate (upsert) creates the record
        .mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(newRecord),
        } as any)

      // findOne returns null (record doesn't exist)
      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      } as any)

      const result = await repository.updateFromRpc(updateParams)

      expect(result).toEqual(newRecord)
      expect(mockBalanceRecordModel.findOneAndUpdate).toHaveBeenCalledTimes(2)
      // Second call should be upsert
      expect(mockBalanceRecordModel.findOneAndUpdate).toHaveBeenNthCalledWith(
        2,
        { chainId: updateParams.chainId, address: updateParams.address },
        expect.any(Object),
        { upsert: true, new: true },
      )
    })

    it('should handle duplicate key errors gracefully', async () => {
      const duplicateError = { code: 11000 }
      const existingRecord = mockBalanceRecord

      mockBalanceRecordModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockRejectedValue(duplicateError),
      } as any)

      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingRecord),
      } as any)

      const result = await repository.updateFromRpc(updateParams)

      expect(result).toEqual(existingRecord)
      expect(mockBalanceRecordModel.findOne).toHaveBeenCalledWith({
        chainId: updateParams.chainId,
        address: updateParams.address,
      })
    })
  })

  describe('aggregation integration scenarios', () => {
    it('should demonstrate complete balance tracking workflow', async () => {
      const chainId = '1'
      const address = 'native' as const
      const initialBlockNumber = '18500000'
      const laterBlockNumber = '18500050'

      // Step 1: Initial RPC update
      const initialRpcParams = {
        chainId,
        address,
        balance: '5000000000000000000', // 5 ETH initial
        blockNumber: initialBlockNumber,
        blockHash: '0xinitial',
        decimals: 18,
        tokenSymbol: 'ETH',
        tokenName: 'Ethereum',
      }

      mockBalanceRecordModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...initialRpcParams,
        }),
      } as any)

      await repository.updateFromRpc(initialRpcParams)

      // Step 2: Some transfers happen (watch services record balance changes)
      // These would be handled by BalanceChangeRepository in real scenario

      // Step 3: Get current balance with outstanding changes
      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          chainId,
          address,
          balance: '5000000000000000000', // Original RPC balance
          blockNumber: initialBlockNumber,
          blockHash: '0xinitial',
          decimals: 18,
        }),
      } as any)

      // Outstanding changes since last RPC update
      const outstandingChanges = BigInt('500000000000000000') // +0.5 ETH from transfers
      mockBalanceChangeRepository.calculateOutstandingBalance.mockResolvedValue(outstandingChanges)

      const currentBalance = await repository.getCurrentBalance(chainId, address)

      expect(currentBalance).toEqual({
        balance: BigInt('5500000000000000000'), // 5 + 0.5 = 5.5 ETH
        blockNumber: initialBlockNumber,
        blockHash: '0xinitial',
        decimals: 18,
      })

      // Step 4: Later RPC update incorporates the changes
      const laterRpcParams = {
        chainId,
        address,
        balance: '5500000000000000000', // Updated RPC balance includes previous changes
        blockNumber: laterBlockNumber,
        blockHash: '0xlater',
        decimals: 18,
        tokenSymbol: 'ETH',
        tokenName: 'Ethereum',
      }

      mockBalanceRecordModel.findOneAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...laterRpcParams,
        }),
      } as any)

      await repository.updateFromRpc(laterRpcParams)

      // Now outstanding changes should be calculated from the later block
      mockBalanceRecordModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          chainId,
          address,
          balance: '5500000000000000000', // Updated RPC balance
          blockNumber: laterBlockNumber,
          blockHash: '0xlater',
          decimals: 18,
        }),
      } as any)

      // New outstanding changes since the later RPC update
      const newOutstandingChanges = BigInt('200000000000000000') // +0.2 ETH new transfers
      mockBalanceChangeRepository.calculateOutstandingBalance.mockResolvedValue(
        newOutstandingChanges,
      )

      const updatedCurrentBalance = await repository.getCurrentBalance(chainId, address)

      expect(updatedCurrentBalance).toEqual({
        balance: BigInt('5700000000000000000'), // 5.5 + 0.2 = 5.7 ETH
        blockNumber: laterBlockNumber,
        blockHash: '0xlater',
        decimals: 18,
      })

      // Verify outstanding changes are calculated from the correct block
      expect(mockBalanceChangeRepository.calculateOutstandingBalance).toHaveBeenLastCalledWith(
        chainId,
        address,
        laterBlockNumber,
      )
    })
  })
})
