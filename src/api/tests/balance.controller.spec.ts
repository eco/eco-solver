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
    it('should return an array of balances', async () => {
      const result = []
      jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue(result)

      expect(await balanceController.getBalances()).toEqual(result)
    })

    it('should call balanceService.getAllTokenData', async () => {
      const getAllTokenDataSpy = jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue([])

      await balanceController.getBalances()

      expect(getAllTokenDataSpy).toHaveBeenCalled()
    })

    it('should take the flat query param', async () => {
      const getAllTokenDataSpy = jest.spyOn(balanceService, 'getAllTokenData').mockResolvedValue([])
      const groupSpy = jest.spyOn(balanceController, 'groupTokensByChain')
      await balanceController.getBalances(true)

      expect(getAllTokenDataSpy).toHaveBeenCalled()
      expect(groupSpy).toHaveBeenCalled()
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
})
