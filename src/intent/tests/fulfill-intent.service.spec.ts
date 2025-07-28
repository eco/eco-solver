import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { UtilsIntentService } from '../utils-intent.service'
import { FulfillIntentService } from '../fulfill-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { WalletFulfillService } from '@/intent/wallet-fulfill.service'
import { EcoAnalyticsService } from '@/analytics'
import { QUEUES } from '@/common/redis/constants'

describe('FulfillIntentService', () => {
  let fulfillIntentService: FulfillIntentService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let walletFulfillService: DeepMocked<WalletFulfillService>
  let crowdLiquidityService: DeepMocked<CrowdLiquidityService>
  let queue: DeepMocked<Queue>

  const address1 = '0x1111111111111111111111111111111111111111'
  const hash = '0xe42305a292d4df6805f686b2d575b01bfcef35f22675a82aacffacb2122b890f'
  const solver = { inboxAddress: address1, chainID: 1 } as any
  const model = {
    intent: {
      route: {
        hash,
        destination: 1,
        calls: [{ value: 0n, target: '0x1', data: '0x' }],
        getHash: () => '0x6543',
      },
      reward: {
        nativeValue: 0n,
        getHash: () => '0x123abc',
      },
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
        { provide: CrowdLiquidityService, useValue: createMock<CrowdLiquidityService>() },
        { provide: EcoAnalyticsService, useValue: createMock<EcoAnalyticsService>() },
        { provide: getQueueToken(QUEUES.SOURCE_INTENT.queue), useValue: createMock<Queue>() },
      ],
    }).compile()

    fulfillIntentService = chainMod.get(FulfillIntentService)
    ecoConfigService = chainMod.get(EcoConfigService)
    utilsIntentService = chainMod.get(UtilsIntentService)
    walletFulfillService = chainMod.get(WalletFulfillService)
    crowdLiquidityService = chainMod.get(CrowdLiquidityService)
    queue = chainMod.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))
  })

  describe('on fulfill', () => {
    beforeEach(() => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue({ model, solver })
      jest.spyOn(ecoConfigService, 'getRedis').mockReturnValue({
        jobs: {
          crowdLiquidityJobConfig: { attempts: 5 },
          walletFulfillJobConfig: { attempts: 3 },
        },
      } as any)
      jest.spyOn(crowdLiquidityService, 'isRouteSupported').mockReturnValue(true)
    })

    it('should throw if data can`t be destructured', async () => {
      //when error
      const error = new Error('stuff went bad')
      utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ err: error })

      await expect(() => fulfillIntentService.fulfill(hash)).rejects.toThrow(error)
    })

    describe('Crowd Liquidity Job Creation', () => {
      beforeEach(() => {
        jest
          .spyOn(ecoConfigService, 'getFulfill')
          .mockReturnValue({ type: 'crowd-liquidity' } as any)
      })

      it('should create crowd liquidity job if fulfill type is crowd-liquidity and route is supported', async () => {
        await fulfillIntentService.fulfill(hash)
        expect(queue.add).toHaveBeenCalledWith(
          QUEUES.SOURCE_INTENT.jobs.fulfill_intent_crowd_liquidity,
          hash,
          expect.objectContaining({
            jobId: expect.stringContaining('crowd-liquidity'),
            attempts: 5,
          })
        )
      })

      it('should create wallet fulfill job if crowd liquidity route is not supported', async () => {
        jest.spyOn(crowdLiquidityService, 'isRouteSupported').mockReturnValue(false)
        
        await fulfillIntentService.fulfill(hash)
        expect(queue.add).toHaveBeenCalledWith(
          QUEUES.SOURCE_INTENT.jobs.fulfill_intent_wallet,
          hash,
          expect.objectContaining({
            jobId: expect.stringContaining('wallet-fulfill'),
            attempts: 3,
          })
        )
      })
    })

    describe('Wallet Fulfill Job Creation', () => {
      beforeEach(() => {
        jest.spyOn(ecoConfigService, 'getFulfill').mockReturnValue({ type: undefined } as any)
      })

      it('should create wallet fulfill job if fulfill type is undefined', async () => {
        await fulfillIntentService.fulfill(hash)
        expect(queue.add).toHaveBeenCalledWith(
          QUEUES.SOURCE_INTENT.jobs.fulfill_intent_wallet,
          hash,
          expect.objectContaining({
            jobId: expect.stringContaining('wallet-fulfill'),
            attempts: 3,
          })
        )
      })
    })
  })

  describe('fulfillWithCrowdLiquidity', () => {
    beforeEach(() => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue({ model, solver })
    })

    it('should call crowdLiquidityService.fulfill when data is valid', async () => {
      const mockTxHash = '0x123abc' as any
      jest.spyOn(crowdLiquidityService, 'fulfill').mockResolvedValue(mockTxHash)

      const result = await fulfillIntentService.fulfillWithCrowdLiquidity(hash)
      
      expect(crowdLiquidityService.fulfill).toHaveBeenCalledWith(model)
      expect(result).toBe(mockTxHash)
    })

    it('should throw error when data retrieval fails', async () => {
      const error = new Error('data error')
      utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ err: error })

      await expect(() => fulfillIntentService.fulfillWithCrowdLiquidity(hash)).rejects.toThrow(error)
    })
  })

  describe('fulfillWithWallet', () => {
    beforeEach(() => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue({ model, solver })
    })

    it('should call walletFulfillService.fulfill when data is valid', async () => {
      const mockTxHash = '0x456def' as any
      jest.spyOn(walletFulfillService, 'fulfill').mockResolvedValue(mockTxHash)

      const result = await fulfillIntentService.fulfillWithWallet(hash)
      
      expect(walletFulfillService.fulfill).toHaveBeenCalledWith(model, solver)
      expect(result).toBe(mockTxHash)
    })

    it('should throw error when data retrieval fails', async () => {
      const error = new Error('data error')
      utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ err: error })

      await expect(() => fulfillIntentService.fulfillWithWallet(hash)).rejects.toThrow(error)
    })
  })
})
