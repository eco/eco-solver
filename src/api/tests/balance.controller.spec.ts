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
  })
})
