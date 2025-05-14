import { Test } from '@nestjs/testing'
import { SolanaFeasableIntentService } from '@/intent/solana-feasable-intent.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { SolanaCostService } from '@/solana/solana-cost.service'
import { SolanaFeeService } from '@/fee/solanaFee.service'
import { FeeService } from '@/fee/fee.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Queue } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { JupiterPriceService } from '@/solana/price/jupiter-price.service'

const mockAdd = jest.fn()

describe('SolanaFeasableIntentService', () => {
  let svc: SolanaFeasableIntentService
  let utils: jest.Mocked<UtilsIntentService>
  let cost: jest.Mocked<SolanaCostService>
  let feeSvc: jest.Mocked<FeeService>
  let jup: any

  const intentHash = '0xdeadbeef' as any

  beforeEach(async () => {
    jest.clearAllMocks()

    const ecoCfg = {
      getRedis: () => ({ jobs: { intentJobConfig: { removeOnComplete: true } } }),
      getSolanaConfig: () => ({
        rpc_url: 'https://api.mainnet-beta.solana.com',
        router_program_id: '',
      }),
    } as unknown as EcoConfigService

    const module = await Test.createTestingModule({
      providers: [
        SolanaFeasableIntentService,
        { provide: UtilsIntentService, useValue: { getIntentProcessData: jest.fn() } },
        { provide: SolanaCostService, useValue: { simulateIntent: jest.fn() } },
        { provide: SolanaFeeService, useValue: { calculateRewardUsdFromAny: jest.fn() } },
        { provide: FeeService, useValue: { getTotalRewards: jest.fn() } },
        { provide: EcoConfigService, useValue: ecoCfg },
        { provide: 'SOLVER_SOLANA_PUBKEY', useValue: {} },
        {
          provide: JupiterPriceService,
          useValue: { getPriceUsd: jest.fn(), getPricesUsd: jest.fn() },
        },
      ],
    })
      .overrideProvider(getQueueToken(QUEUES.SOLANA_INTENT.queue))
      .useValue({ add: mockAdd } as unknown as Queue)
      .compile()

    svc = module.get(SolanaFeasableIntentService)
    utils = module.get(UtilsIntentService) as any
    cost = module.get(SolanaCostService) as any
    feeSvc = module.get(FeeService) as any
    jup = module.get(JupiterPriceService)
  })

  const baseProcessData = {
    model: {
      intent: {
        logIndex: 1,
        hash: intentHash,
        route: { source: BigInt(1) },
        reward: { nativeValue: 0n, tokens: [] },
      },
    },
  } as any

  it('marks not profitable intents', async () => {
    utils.getIntentProcessData.mockResolvedValue(baseProcessData)
    cost.simulateIntent.mockResolvedValue({
      lamportsOut: 10n,
      tokenOut: {},
    } as any)

    // reward USD < intent execution USD
    feeSvc.getTotalRewards.mockResolvedValue({ totalRewardsNormalized: 1n, error: undefined })

    await svc.feasableIntent(intentHash)
    expect(mockAdd).not.toHaveBeenCalled()
  })

  it('enqueues profitable intents', async () => {
    utils.getIntentProcessData.mockResolvedValue(baseProcessData)
    cost.simulateIntent.mockResolvedValue({
      lamportsOut: 1n,
      tokenOut: {},
    } as any)

    feeSvc.getTotalRewards.mockResolvedValue({ totalRewardsNormalized: 10n, error: undefined })

    await svc.feasableIntent(intentHash)

    expect(mockAdd).toHaveBeenCalledWith(
      QUEUES.SOLANA_INTENT.jobs.fulfill_intent,
      expect.objectContaining({ hash: intentHash }),
      expect.objectContaining({ jobId: expect.any(String) }),
    )
  })
})
