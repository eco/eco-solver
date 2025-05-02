import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { UtilsIntentService } from '../utils-intent.service'
import { FulfillIntentService } from '../fulfill-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { WalletFulfillService } from '@/intent/wallet-fulfill.service'

describe('FulfillIntentService', () => {
  let fulfillIntentService: FulfillIntentService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let walletFulfillService: DeepMocked<WalletFulfillService>
  let crowdLiquidityService: DeepMocked<CrowdLiquidityService>

  const address1 = '0x1111111111111111111111111111111111111111'
  const hash = '0xe42305a292d4df6805f686b2d575b01bfcef35f22675a82aacffacb2122b890f'
  const solver = { inboxAddress: address1, chainID: 1 } as any
  const model = {
    intent: {
      route: { hash, destination: 1, getHash: () => '0x6543' },
      reward: { getHash: () => '0x123abc' },
      getHash: () => {
        return { intentHash: '0xaaaa999' }
      },
    },
    event: { sourceChainID: 11111 },
  } as any

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        FulfillIntentService,
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: WalletFulfillService, useValue: createMock<WalletFulfillService>() },
        { provide: CrowdLiquidityService, useValue: createMock<EcoConfigService>() },
      ],
    }).compile()

    fulfillIntentService = chainMod.get(FulfillIntentService)
    ecoConfigService = chainMod.get(EcoConfigService)
    utilsIntentService = chainMod.get(UtilsIntentService)
    walletFulfillService = chainMod.get(WalletFulfillService)
    crowdLiquidityService = chainMod.get(CrowdLiquidityService)
  })

  describe('on fulfill', () => {
    beforeEach(() => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue({ model, solver })
    })

    it('should throw if data can`t be destructured', async () => {
      //when error
      const error = new Error('stuff went bad')
      utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ err: error })

      await expect(() => fulfillIntentService.fulfill(hash)).rejects.toThrow(error)
    })

    describe('Wallet Fulfills', () => {
      beforeEach(() => {
        jest
          .spyOn(ecoConfigService, 'getFulfill')
          .mockReturnValue({ type: 'crowd-liquidity' } as any)
      })

      it('should fulfill using crowd liquidity if fulfill type is crowd-liquidity', async () => {
        await fulfillIntentService.fulfill(hash)
        expect(crowdLiquidityService.fulfill).toHaveBeenCalled()
      })
    })

    describe('Crowd Liquidity Fulfills', () => {
      beforeEach(() => {
        jest.spyOn(ecoConfigService, 'getFulfill').mockReturnValue({ type: undefined } as any)
      })

      it('should fulfill using smart wallet account if fulfill type is undefined', async () => {
        await fulfillIntentService.fulfill(hash)
        expect(walletFulfillService.fulfill).toHaveBeenCalled()
      })
    })
  })
})
