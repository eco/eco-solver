import { Test, TestingModule } from '@nestjs/testing'
import { BalanceController } from '../balance.controller'
import { BalanceService } from '@/balance/balance.service'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { createMock } from '@golevelup/ts-jest'

describe('BalanceController Test', () => {
  let balanceController: BalanceController
  let balanceService: BalanceService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BalanceController],
      providers: [
        {
          provide: BalanceService,
          useValue: createMock<BalanceService>(),
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
    balanceService = module.get<BalanceService>(BalanceService)
  })

  it('should be defined', () => {
    expect(balanceController).toBeDefined()
  })

  describe('getBalances', () => {
    it('should return deconverted balances', async () => {
      const mockData = [
        {
          config: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId: 1,
            minBalance: 1000000n,
            targetBalance: 50000000n,
            type: 'erc20',
          },
          balance: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            balance: 50000000000000000000n, // normalized to 18 decimals
            decimals: {
              original: 6,
              current: 18,
            },
          },
          chainId: 1,
        },
      ]
      jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue(mockData as any)

      const result = await balanceController.getBalances()

      // Should deconvert from 18 decimals back to 6 decimals (50000000000000000000n -> 50000000n)
      expect(result[0].balance.balance).toBe('50000000')
    })

    it('should call balanceService.getAllTokenData', async () => {
      const getAllTokenDataSpy = jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue([])

      await balanceController.getBalances()

      expect(getAllTokenDataSpy).toHaveBeenCalled()
    })

    it('should take the flat query param and return grouped data', async () => {
      const mockData = [
        {
          config: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId: 1,
            minBalance: 1000000n,
            targetBalance: 50000000n,
            type: 'erc20',
          },
          balance: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            balance: 50000000000000000000n,
            decimals: {
              original: 6,
              current: 18,
            },
          },
          chainId: 1,
        },
      ]
      const getAllTokenDataSpy = jest
        .spyOn(balanceService, 'getAllTokenData')
        .mockResolvedValue(mockData as any)
      const groupSpy = jest.spyOn(balanceController, 'groupTokensByChain')

      const result = await balanceController.getBalances(true)

      expect(getAllTokenDataSpy).toHaveBeenCalled()
      expect(groupSpy).toHaveBeenCalled()
      expect(result['1'][0].balance).toBe('50000000')
    })
  })

  describe('groupTokensByChain', () => {
    it('should group tokens by chain and extract address and balance', async () => {
      const data = [
        {
          config: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            chainId: 1,
            minBalance: 1000000n,
            targetBalance: 50000000n,
            type: 'erc20',
          },
          balance: {
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            balance: 50995350000n,
            decimals: {
              original: 6,
              current: 18,
            },
          },
          chainId: 1,
        },
        {
          config: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            chainId: 1,
            minBalance: 1000000n,
            targetBalance: 50000000n,
            type: 'erc20',
          },
          balance: {
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            balance: 50000000000n,
            decimals: {
              original: 6,
              current: 18,
            },
          },
          chainId: 1,
        },
        {
          config: {
            address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            chainId: 42161,
            type: 'erc20',
            minBalance: 200n,
            targetBalance: 50000n,
          },
          balance: {
            address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            balance: 25368636844n,
            decimals: {
              original: 6,
              current: 18,
            },
          },
          chainId: 42161,
        },
      ] as any

      const result = balanceController.groupTokensByChain(data)
      expect(result).toEqual({
        1: [
          { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', balance: 50995350000n },
          { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', balance: 50000000000n },
        ],
        42161: [{ address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', balance: 25368636844n }],
      })
    })
  })
})
