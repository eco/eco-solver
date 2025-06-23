import { Test, TestingModule } from '@nestjs/testing'
import { BalanceController } from '../balance.controller'
import { RpcBalanceService } from '@/balance/services/rpc-balance.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { createMock } from '@golevelup/ts-jest'

describe('BalanceController Test', () => {
  let balanceController: BalanceController
  let balanceService: RpcBalanceService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceController],
      providers: [
        {
          provide: RpcBalanceService,
          useValue: createMock<RpcBalanceService>(),
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile()

    balanceController = module.get<BalanceController>(BalanceController)
    balanceService = module.get<RpcBalanceService>(RpcBalanceService)
  })

  it('should be defined', () => {
    expect(balanceController).toBeDefined()
  })

  describe('getBalances', () => {
    it('should return tokens and native balances', async () => {
      const tokenData = [
        {
          config: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: 1 },
          balance: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            balance: '1000000',
            decimals: 6,
          },
          chainId: 1,
        },
      ]
      const nativeData = [
        { chainId: 1, balance: 500000000000000000n, blockNumber: 18500000n },
        { chainId: 42161, balance: 200000000000000000n, blockNumber: 145000000n },
      ]

      jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue(tokenData as any)
      jest.spyOn(balanceService, 'fetchAllNativeBalances').mockResolvedValue(nativeData as any)

      const result = await balanceController.getBalances()

      expect(result).toEqual({
        tokens: tokenData,
        native: [
          { chainId: 1, balance: '500000000000000000', blockNumber: '18500000' },
          { chainId: 42161, balance: '200000000000000000', blockNumber: '145000000' },
        ],
      })
    })

    it('should call both token and native balance services', async () => {
      const getAllTokenDataSpy = jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue([])
      const fetchAllNativeBalancesSpy = jest
        .spyOn(balanceService, 'fetchAllNativeBalances')
        .mockResolvedValue([])

      await balanceController.getBalances()

      expect(getAllTokenDataSpy).toHaveBeenCalled()
      expect(fetchAllNativeBalancesSpy).toHaveBeenCalled()
    })

    it('should filter out null native balances', async () => {
      const tokenData = []
      const nativeData = [
        { chainId: 1, balance: 500000000000000000n, blockNumber: 18500000n },
        null, // This should be filtered out
        { chainId: 42161, balance: 200000000000000000n, blockNumber: 145000000n },
      ]

      jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue(tokenData as any)
      jest.spyOn(balanceService, 'fetchAllNativeBalances').mockResolvedValue(nativeData as any)

      const result = await balanceController.getBalances()

      expect(result.native).toHaveLength(2)
      expect(result.native).not.toContain(null)
    })

    it('should group data by chain when flat=true', async () => {
      const tokenData = [
        {
          config: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chainId: 1 },
          balance: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            balance: '1000000',
            decimals: 6,
          },
          chainId: 1,
        },
      ]
      const nativeData = [{ chainId: 1, balance: 500000000000000000n, blockNumber: 18500000n }]

      jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue(tokenData as any)
      jest.spyOn(balanceService, 'fetchAllNativeBalances').mockResolvedValue(nativeData as any)
      const groupTokensSpy = jest.spyOn(balanceController, 'groupTokensByChain')
      const groupNativeSpy = jest.spyOn(balanceController, 'groupNativeByChain')

      await balanceController.getBalances(true)

      expect(groupTokensSpy).toHaveBeenCalledWith(tokenData)
      expect(groupNativeSpy).toHaveBeenCalledWith(nativeData)
    })
  })

  describe('groupTokensByChain', () => {
    it('should flatten', async () => {
      const data = [
        {
          balance: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            balance: '50995350000',
            decimals: 6,
          },
          chainId: 1,
        },
        {
          config: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            chainId: 1,
          },
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: '50000000000',
            decimals: 6,
          },
          chainId: 1,
        },
        {
          config: {
            address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            chainId: 42161,
            type: 'erc20',
            minBalance: 200,
            targetBalance: 50000,
          },
          balance: {
            address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            balance: '25368636844',
            decimals: 6,
          },
          chainId: 42161,
        },
      ] as any

      const result = balanceController.groupTokensByChain(data)
      expect(result).toEqual({
        1: [
          { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', balance: '50995350000' },
          { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', balance: '50000000000' },
        ],
        42161: [{ address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', balance: '25368636844' }],
      })
    })
  })

  describe('groupNativeByChain', () => {
    it('should group native balances by chainId', () => {
      const data = [
        { chainId: 1, balance: 500000000000000000n, blockNumber: 18500000n },
        { chainId: 42161, balance: 200000000000000000n, blockNumber: 145000000n },
        { chainId: 137, balance: 1000000000000000000n, blockNumber: 48500000n },
      ]

      const result = balanceController.groupNativeByChain(data)

      expect(result).toEqual({
        1: { balance: 500000000000000000n, blockNumber: 18500000n },
        42161: { balance: 200000000000000000n, blockNumber: 145000000n },
        137: { balance: 1000000000000000000n, blockNumber: 48500000n },
      })
    })

    it('should handle single native balance per chain', () => {
      const data = [{ chainId: 1, balance: 500000000000000000n, blockNumber: 18500000n }]

      const result = balanceController.groupNativeByChain(data)

      expect(result).toEqual({
        1: { balance: 500000000000000000n, blockNumber: 18500000n },
      })
    })

    it('should handle empty native balance data', () => {
      const data: any[] = []

      const result = balanceController.groupNativeByChain(data)

      expect(result).toEqual({})
    })

    it('should take first native balance when multiple exist for same chain', () => {
      // This scenario shouldn't happen in practice, but test the behavior
      const data = [
        { chainId: 1, balance: 500000000000000000n, blockNumber: 18500000n },
        { chainId: 1, balance: 600000000000000000n, blockNumber: 18500001n }, // Second one should be ignored
      ]

      const result = balanceController.groupNativeByChain(data)

      expect(result).toEqual({
        1: { balance: 500000000000000000n, blockNumber: 18500000n }, // First one is kept
      })
    })
  })
})
