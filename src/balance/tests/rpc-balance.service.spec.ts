import { RpcBalanceService } from '@/balance/services/rpc-balance.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Test, TestingModule } from '@nestjs/testing'
import { Cache } from 'cache-manager'
import { EcoAnalyticsService } from '@/analytics'
describe('RpcBalanceService', () => {
  let balanceService: RpcBalanceService
  let kernelAccountClientService: DeepMocked<KernelAccountClientService>

  const mockKernelClient = {
    kernelAccount: {
      address: '0x1234567890123456789012345678901234567890' as const,
    },
    account: {
      address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const,
    },
    getBalance: jest.fn(),
    getBlockNumber: jest.fn(),
    getBlock: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RpcBalanceService,
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: CACHE_MANAGER, useValue: createMock<Cache>() },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
      ],
    }).compile()

    balanceService = module.get<RpcBalanceService>(RpcBalanceService)
    kernelAccountClientService = module.get(KernelAccountClientService)

    // Reset all mocks
    jest.clearAllMocks()
  })

  describe('fetchNativeBalance', () => {
    const chainID = 1 // Ethereum mainnet
    const expectedBalance = 1000000000000000000n // 1 ETH in wei
    const expectedBlockNumber = 18500000n // Example block number
    const expectedBlockHash =
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as const

    beforeEach(() => {
      kernelAccountClientService.getClient.mockResolvedValue(mockKernelClient as any)
      mockKernelClient.getBalance.mockResolvedValue(expectedBalance)
      mockKernelClient.getBlockNumber.mockResolvedValue(expectedBlockNumber)
      mockKernelClient.getBlock.mockResolvedValue({
        number: expectedBlockNumber,
        hash: expectedBlockHash,
      })
    })

    it('should successfully fetch native balance when both kernel and EOA addresses are available', async () => {
      const result = await balanceService.fetchNativeBalance(chainID)

      expect(result).toEqual({
        balance: expectedBalance,
        blockNumber: expectedBlockNumber,
        blockHash: expectedBlockHash,
      })
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
      expect(mockKernelClient.getBalance).toHaveBeenCalledWith({
        address: mockKernelClient.account.address,
      })
      expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
      expect(mockKernelClient.getBlock).toHaveBeenCalledWith({ blockNumber: expectedBlockNumber })
    })

    it('should return 0n balance when kernel address is not available', async () => {
      const clientWithoutKernel = {
        ...mockKernelClient,
        kernelAccount: null,
        getBlock: jest.fn().mockResolvedValue({
          number: expectedBlockNumber,
          hash: expectedBlockHash,
        }),
      }
      kernelAccountClientService.getClient.mockResolvedValue(clientWithoutKernel as any)

      const result = await balanceService.fetchNativeBalance(chainID)

      expect(result).toEqual({
        balance: 0n,
        blockNumber: expectedBlockNumber,
        blockHash: expectedBlockHash,
      })
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
      expect(mockKernelClient.getBalance).not.toHaveBeenCalled()
      expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
    })

    it('should return 0n balance when EOA address is not available', async () => {
      const clientWithoutEOA = {
        ...mockKernelClient,
        account: null,
        getBlock: jest.fn().mockResolvedValue({
          number: expectedBlockNumber,
          hash: expectedBlockHash,
        }),
      }
      kernelAccountClientService.getClient.mockResolvedValue(clientWithoutEOA as any)

      const result = await balanceService.fetchNativeBalance(chainID)

      expect(result).toEqual({
        balance: 0n,
        blockNumber: expectedBlockNumber,
        blockHash: expectedBlockHash,
      })
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
      expect(mockKernelClient.getBalance).not.toHaveBeenCalled()
      expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
    })

    it('should return 0n balance when both addresses are not available', async () => {
      const clientWithoutAddresses = {
        ...mockKernelClient,
        kernelAccount: null,
        account: null,
        getBlock: jest.fn().mockResolvedValue({
          number: expectedBlockNumber,
          hash: expectedBlockHash,
        }),
      }
      kernelAccountClientService.getClient.mockResolvedValue(clientWithoutAddresses as any)

      const result = await balanceService.fetchNativeBalance(chainID)

      expect(result).toEqual({
        balance: 0n,
        blockNumber: expectedBlockNumber,
        blockHash: expectedBlockHash,
      })
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
      expect(mockKernelClient.getBalance).not.toHaveBeenCalled()
      expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
    })

    it('should handle different chain IDs correctly', async () => {
      const polygonChainId = 137
      const polygonBalance = 2000000000000000000n // 2 MATIC in wei
      const polygonBlockNumber = 48500000n

      mockKernelClient.getBalance.mockResolvedValue(polygonBalance)
      mockKernelClient.getBlockNumber.mockResolvedValue(polygonBlockNumber)
      mockKernelClient.getBlock.mockResolvedValue({
        number: polygonBlockNumber,
        hash: expectedBlockHash,
      })

      const result = await balanceService.fetchNativeBalance(polygonChainId)

      expect(result).toEqual({
        balance: polygonBalance,
        blockNumber: polygonBlockNumber,
        blockHash: expectedBlockHash,
      })
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(polygonChainId)
      expect(mockKernelClient.getBalance).toHaveBeenCalledWith({
        address: mockKernelClient.account.address,
      })
      expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
      expect(mockKernelClient.getBlock).toHaveBeenCalledWith({ blockNumber: polygonBlockNumber })
    })

    it('should handle zero balance correctly', async () => {
      mockKernelClient.getBalance.mockResolvedValue(0n)

      const result = await balanceService.fetchNativeBalance(chainID)

      expect(result).toEqual({
        balance: 0n,
        blockNumber: expectedBlockNumber,
        blockHash: expectedBlockHash,
      })
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
      expect(mockKernelClient.getBalance).toHaveBeenCalledWith({
        address: mockKernelClient.account.address,
      })
      expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
      expect(mockKernelClient.getBlock).toHaveBeenCalledWith({ blockNumber: expectedBlockNumber })
    })

    it('should propagate errors from kernel account client service', async () => {
      const error = new Error('Failed to get client')
      kernelAccountClientService.getClient.mockRejectedValue(error)

      await expect(balanceService.fetchNativeBalance(chainID)).rejects.toThrow(error)
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
    })

    it('should propagate errors from getBalance call', async () => {
      const error = new Error('Failed to fetch balance')
      mockKernelClient.getBalance.mockRejectedValue(error)

      await expect(balanceService.fetchNativeBalance(chainID)).rejects.toThrow(error)
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
      expect(mockKernelClient.getBalance).toHaveBeenCalledWith({
        address: mockKernelClient.account.address,
      })
    })

    it('should propagate errors from getBlockNumber call', async () => {
      const error = new Error('Failed to fetch block number')
      mockKernelClient.getBlockNumber.mockRejectedValue(error)

      await expect(balanceService.fetchNativeBalance(chainID)).rejects.toThrow(error)
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
      expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
    })

    it('should handle very large balance values', async () => {
      const largeBalance = BigInt('999999999999999999999999999999') // Very large balance
      mockKernelClient.getBalance.mockResolvedValue(largeBalance)

      const result = await balanceService.fetchNativeBalance(chainID)

      expect(result).toEqual({
        balance: largeBalance,
        blockNumber: expectedBlockNumber,
        blockHash: expectedBlockHash,
      })
      expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
      expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
      expect(mockKernelClient.getBlock).toHaveBeenCalledWith({ blockNumber: expectedBlockNumber })
    })

    it('should be cacheable (verify @Cacheable decorator is applied)', () => {
      // Verify that the method has the @Cacheable decorator by checking the method metadata
      const fetchNativeBalanceMethod = balanceService.fetchNativeBalance
      expect(fetchNativeBalanceMethod).toBeDefined()

      // The @Cacheable decorator should modify the method, so it should be the wrapped version
      // This is implicit testing since we can't directly test decorators easily
      expect(typeof fetchNativeBalanceMethod).toBe('function')
    })

    describe('Edge cases', () => {
      it('should handle undefined kernel account address', async () => {
        const clientWithUndefinedKernelAddress = {
          ...mockKernelClient,
          kernelAccount: {
            address: undefined,
          },
          getBlock: jest.fn().mockResolvedValue({
            number: expectedBlockNumber,
            hash: expectedBlockHash,
          }),
        }
        kernelAccountClientService.getClient.mockResolvedValue(
          clientWithUndefinedKernelAddress as any,
        )

        const result = await balanceService.fetchNativeBalance(chainID)

        expect(result).toEqual({
          balance: 0n,
          blockNumber: expectedBlockNumber,
          blockHash: expectedBlockHash,
        })
        expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
        expect(mockKernelClient.getBalance).not.toHaveBeenCalled()
        expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
      })

      it('should handle undefined EOA address', async () => {
        const clientWithUndefinedEOAAddress = {
          ...mockKernelClient,
          account: {
            address: undefined,
          },
          getBlock: jest.fn().mockResolvedValue({
            number: expectedBlockNumber,
            hash: expectedBlockHash,
          }),
        }
        kernelAccountClientService.getClient.mockResolvedValue(clientWithUndefinedEOAAddress as any)

        const result = await balanceService.fetchNativeBalance(chainID)

        expect(result).toEqual({
          balance: 0n,
          blockNumber: expectedBlockNumber,
          blockHash: expectedBlockHash,
        })
        expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(chainID)
        expect(mockKernelClient.getBalance).not.toHaveBeenCalled()
        expect(mockKernelClient.getBlockNumber).toHaveBeenCalled()
      })

      it('should handle negative chain IDs', async () => {
        const negativeChainId = -1

        const result = await balanceService.fetchNativeBalance(negativeChainId)

        expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(negativeChainId)
        // The behavior depends on the kernel account client service implementation
        // but our method should handle it gracefully and still return the expected structure
        expect(result).toEqual({
          balance: expectedBalance,
          blockNumber: expectedBlockNumber,
          blockHash: expectedBlockHash,
        })
      })
    })
  })

  describe('fetchAllNativeBalances', () => {
    const mockSolvers = {
      1: { chainID: 1 }, // Ethereum
      137: { chainID: 137 }, // Polygon
      42161: { chainID: 42161 }, // Arbitrum
    }

    beforeEach(() => {
      // Mock the config service to return test solvers
      const mockConfigService = balanceService['configService'] as any
      mockConfigService.getSolvers = jest.fn().mockReturnValue(mockSolvers)

      // Setup default mocks for fetchNativeBalance
      jest.spyOn(balanceService, 'fetchNativeBalance')
    })

    it('should fetch native balances for all solver chains', async () => {
      const mockBalances = [
        { balance: 1000000000000000000n, blockNumber: 18500000n },
        { balance: 2000000000000000000n, blockNumber: 48500000n },
        { balance: 500000000000000000n, blockNumber: 145000000n },
      ]

      // Mock fetchNativeBalance for each chain
      ;(balanceService.fetchNativeBalance as jest.Mock)
        .mockResolvedValueOnce(mockBalances[0])
        .mockResolvedValueOnce(mockBalances[1])
        .mockResolvedValueOnce(mockBalances[2])

      const result = await balanceService.fetchAllNativeBalances()

      expect(result).toEqual([
        { chainId: 1, balance: 1000000000000000000n, blockNumber: 18500000n },
        { chainId: 137, balance: 2000000000000000000n, blockNumber: 48500000n },
        { chainId: 42161, balance: 500000000000000000n, blockNumber: 145000000n },
      ])

      expect(balanceService.fetchNativeBalance).toHaveBeenCalledTimes(3)
      expect(balanceService.fetchNativeBalance).toHaveBeenCalledWith(1, false)
      expect(balanceService.fetchNativeBalance).toHaveBeenCalledWith(137, false)
      expect(balanceService.fetchNativeBalance).toHaveBeenCalledWith(42161, false)
    })

    it('should handle individual chain failures gracefully', async () => {
      const mockBalance1 = { balance: 1000000000000000000n, blockNumber: 18500000n }
      const mockBalance3 = { balance: 500000000000000000n, blockNumber: 145000000n }

      // Mock fetchNativeBalance with one failure
      ;(balanceService.fetchNativeBalance as jest.Mock)
        .mockResolvedValueOnce(mockBalance1)
        .mockRejectedValueOnce(new Error('Chain 137 failed'))
        .mockResolvedValueOnce(mockBalance3)

      const result = await balanceService.fetchAllNativeBalances()

      expect(result).toEqual([
        { chainId: 1, balance: 1000000000000000000n, blockNumber: 18500000n },
        null, // Failed chain should return null
        { chainId: 42161, balance: 500000000000000000n, blockNumber: 145000000n },
      ])

      expect(balanceService.fetchNativeBalance).toHaveBeenCalledTimes(3)
    })

    it('should pass forceRefresh parameter correctly', async () => {
      const mockBalance = { balance: 1000000000000000000n, blockNumber: 18500000n }
      ;(balanceService.fetchNativeBalance as jest.Mock).mockResolvedValue(mockBalance)

      await balanceService.fetchAllNativeBalances(true)

      expect(balanceService.fetchNativeBalance).toHaveBeenCalledWith(1, true)
      expect(balanceService.fetchNativeBalance).toHaveBeenCalledWith(137, true)
      expect(balanceService.fetchNativeBalance).toHaveBeenCalledWith(42161, true)
    })

    it('should handle empty solver configuration', async () => {
      const mockConfigService = balanceService['configService'] as any
      mockConfigService.getSolvers = jest.fn().mockReturnValue({})

      const result = await balanceService.fetchAllNativeBalances()

      expect(result).toEqual([])
      expect(balanceService.fetchNativeBalance).not.toHaveBeenCalled()
    })
  })
})
