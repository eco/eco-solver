import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { BalanceService } from '../services/balance.service'
import { BalanceRecordRepository } from '../repositories/balance-record.repository'
import { RpcBalanceService } from '../services/rpc-balance.service'
import { Queue } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'

describe('BalanceService', () => {
  let service: BalanceService
  let balanceRecordRepository: DeepMocked<BalanceRecordRepository>
  let rpcBalanceService: DeepMocked<RpcBalanceService>
  let mockQueue: DeepMocked<Queue>

  const mockBalanceRecords = [
    {
      _id: '507f1f77bcf86cd799439011',
      chainId: '1',
      tokenAddress: '0x1234567890123456789012345678901234567890',
      balance: '1000000000000000000',
      blockNumber: '18500000',
      blockHash: '0xabcdef',
      timestamp: new Date('2023-10-01T12:00:00Z'),
      decimals: 6,
    },
    {
      _id: '507f1f77bcf86cd799439012',
      chainId: '1',
      tokenAddress: '0x9876543210987654321098765432109876543210',
      balance: '2000000000000000000',
      blockNumber: '18500100',
      blockHash: '0xfedcba',
      timestamp: new Date('2023-10-01T12:05:00Z'),
      decimals: 6,
    },
    {
      _id: '507f1f77bcf86cd799439013',
      chainId: '1',
      tokenAddress: 'native',
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
          provide: RpcBalanceService,
          useValue: createMock<RpcBalanceService>(),
        },
        {
          provide: getQueueToken(QUEUES.BALANCE_MONITOR.queue),
          useValue: createMock<Queue>(),
        },
      ],
    }).compile()

    service = module.get<BalanceService>(BalanceService)
    balanceRecordRepository = module.get(BalanceRecordRepository)
    rpcBalanceService = module.get(RpcBalanceService)
    mockQueue = module.get(getQueueToken(QUEUES.BALANCE_MONITOR.queue))

    // Reset all mocks
    jest.clearAllMocks()
  })

  describe('getLatestBalanceRecordsByChain', () => {
    const chainId = 1

    it('should successfully fetch latest balance records for a chain', async () => {
      balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue(mockBalanceRecords)

      const result = await service.getLatestBalanceRecordsByChain(chainId)

      expect(result).toEqual(mockBalanceRecords)
      expect(balanceRecordRepository.findLatestBalanceRecordsByChain).toHaveBeenCalledWith(
        BigInt(chainId),
      )
    })

    it('should return empty array when no records found', async () => {
      balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue([])

      const result = await service.getLatestBalanceRecordsByChain(chainId)

      expect(result).toEqual([])
      expect(balanceRecordRepository.findLatestBalanceRecordsByChain).toHaveBeenCalledWith(
        BigInt(chainId),
      )
    })

    it('should handle errors gracefully and return empty array', async () => {
      const error = new Error('Database connection failed')
      balanceRecordRepository.findLatestBalanceRecordsByChain.mockRejectedValue(error)

      const result = await service.getLatestBalanceRecordsByChain(chainId)

      expect(result).toEqual([])
      expect(balanceRecordRepository.findLatestBalanceRecordsByChain).toHaveBeenCalledWith(
        BigInt(chainId),
      )
    })

    it('should handle different chain IDs correctly', async () => {
      const polygonChainId = 137
      const polygonRecords = [
        {
          ...mockBalanceRecords[0],
          chainId: '137',
          tokenAddress: '0xpolygontoken1234567890123456789012345678',
        },
      ] as any[]

      balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue(polygonRecords)

      const result = await service.getLatestBalanceRecordsByChain(polygonChainId)

      expect(result).toEqual(polygonRecords)
      expect(balanceRecordRepository.findLatestBalanceRecordsByChain).toHaveBeenCalledWith(
        BigInt(polygonChainId),
      )
    })

    it('should handle large chain IDs correctly', async () => {
      const arbitrumChainId = 42161
      const arbitrumRecords = [
        {
          ...mockBalanceRecords[0],
          chainId: '42161',
          tokenAddress: '0xarbitrumtoken1234567890123456789012345678',
        },
      ] as any[]

      balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue(arbitrumRecords)

      const result = await service.getLatestBalanceRecordsByChain(arbitrumChainId)

      expect(result).toEqual(arbitrumRecords)
      expect(balanceRecordRepository.findLatestBalanceRecordsByChain).toHaveBeenCalledWith(
        BigInt(arbitrumChainId),
      )
    })

    it('should handle mixed token types (ERC20 and native)', async () => {
      const mixedRecords = [
        mockBalanceRecords[0], // ERC20 token
        mockBalanceRecords[2], // native token
      ]

      balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue(mixedRecords)

      const result = await service.getLatestBalanceRecordsByChain(chainId)

      expect(result).toEqual(mixedRecords)
      expect(result).toHaveLength(2)
      expect(result.some((record) => record.tokenAddress === 'native')).toBe(true)
      expect(result.some((record) => record.tokenAddress.startsWith('0x'))).toBe(true)
    })

    it('should properly convert chainId to BigInt', async () => {
      const chainIdNumber = 1337
      balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue([])

      await service.getLatestBalanceRecordsByChain(chainIdNumber)

      expect(balanceRecordRepository.findLatestBalanceRecordsByChain).toHaveBeenCalledWith(
        BigInt(1337),
      )
    })

    describe('Error handling edge cases', () => {
      it('should handle repository throwing TypeError', async () => {
        balanceRecordRepository.findLatestBalanceRecordsByChain.mockRejectedValue(
          new TypeError('Invalid argument type'),
        )

        const result = await service.getLatestBalanceRecordsByChain(chainId)

        expect(result).toEqual([])
      })

      it('should handle repository throwing generic Error', async () => {
        balanceRecordRepository.findLatestBalanceRecordsByChain.mockRejectedValue(
          new Error('Generic error'),
        )

        const result = await service.getLatestBalanceRecordsByChain(chainId)

        expect(result).toEqual([])
      })

      it('should handle repository returning null (edge case)', async () => {
        balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue(null as any)

        const result = await service.getLatestBalanceRecordsByChain(chainId)

        expect(result).toEqual([])
      })

      it('should handle repository returning undefined (edge case)', async () => {
        balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue(undefined as any)

        const result = await service.getLatestBalanceRecordsByChain(chainId)

        expect(result).toEqual([])
      })
    })

    describe('Performance and data validation', () => {
      it('should handle large datasets efficiently', async () => {
        const largeDataset = Array.from({ length: 1000 }, (_, index) => ({
          ...mockBalanceRecords[0],
          _id: `507f1f77bcf86cd799${String(index).padStart(6, '0')}`,
          tokenAddress: `0x${String(index).padStart(40, '0')}`,
          blockNumber: String(18500000 + index),
        }))

        balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue(largeDataset)

        const result = await service.getLatestBalanceRecordsByChain(chainId)

        expect(result).toEqual(largeDataset)
        expect(result).toHaveLength(1000)
      })

      it('should handle records with edge case balance values', async () => {
        const edgeRecords = [
          {
            ...mockBalanceRecords[0],
            balance: '0', // Zero balance
          },
          {
            ...mockBalanceRecords[1],
            balance: '999999999999999999999999999999', // Very large balance
          },
        ]

        balanceRecordRepository.findLatestBalanceRecordsByChain.mockResolvedValue(edgeRecords)

        const result = await service.getLatestBalanceRecordsByChain(chainId)

        expect(result).toEqual(edgeRecords)
        expect(result[0].balance).toBe('0')
        expect(result[1].balance).toBe('999999999999999999999999999999')
      })
    })
  })
})
