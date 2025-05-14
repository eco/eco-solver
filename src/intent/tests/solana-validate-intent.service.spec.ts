import { Test } from '@nestjs/testing'
import { SolanaValidateIntentService } from '@/intent/solana-validate-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { Queue } from 'bullmq'
import { getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '@/common/redis/constants'
import { PublicKey } from '@solana/web3.js'
import { JobsOptions } from 'bullmq'

const mockFetchRaw = jest.fn()
jest.mock('@/solana/utils', () => ({
  ...jest.requireActual('@/solana/utils'),
  fetchRawSvmIntentAccount: (...args: any[]) => mockFetchRaw(...args),
}))

const mockAddJob = jest.fn()

jest.mock('@solana/web3.js', () => {
  const real = jest.requireActual('@solana/web3.js')
  return {
    ...real,
    Connection: jest.fn().mockImplementation(() => ({})),
  }
})

describe('SolanaValidateIntentService', () => {
  let service: SolanaValidateIntentService
  let utils: jest.Mocked<UtilsIntentService>

  const intentHash = '0xaaaa' as any

  beforeEach(async () => {
    jest.clearAllMocks()

    const ecoCfgMock = {
      getSolanaConfig: () => ({
        rpc_url: 'https://api.mainnet-beta.solana.com',
        router_program_id: new PublicKey(1).toBase58(),
      }),
      getRedis: () => ({ jobs: { intentJobConfig: { delay: 0 } as JobsOptions } }),
      getSolver: jest.fn().mockReturnValue({}),
    } as unknown as EcoConfigService

    const module = await Test.createTestingModule({
      providers: [
        SolanaValidateIntentService,
        { provide: EcoConfigService, useValue: ecoCfgMock },
        { provide: UtilsIntentService, useValue: { getIntentProcessData: jest.fn() } },
      ],
    })
      .overrideProvider(getQueueToken(QUEUES.SOLANA_INTENT.queue))
      .useValue({ add: mockAddJob } as unknown as Queue)
      .compile()

    service = module.get(SolanaValidateIntentService)
    utils = module.get(UtilsIntentService) as any

    service.onModuleInit()
  })

  it('returns false when DB entry is missing', async () => {
    utils.getIntentProcessData.mockResolvedValue(undefined as any)

    const ok = await service.validateIntent(intentHash)
    expect(ok).toBe(false)
    expect(mockAddJob).not.toHaveBeenCalled()
  })

  it('rejects intents not funded / wrong status', async () => {
    utils.getIntentProcessData.mockResolvedValue({ model: { intent: { logIndex: 1 } } } as any)

    mockFetchRaw.mockResolvedValue({
      status: 0,
      tokens_funded: 0,
      native_funded: 0,
      reward: { deadline: Date.now() / 1000 + 3600 },
      route: { destination_domain_id: 1 },
    })

    const ok = await service.validateIntent(intentHash)
    expect(ok).toBe(false)
    expect(mockAddJob).not.toHaveBeenCalled()
  })

  it('enqueues for feasability when everything is fine', async () => {
    utils.getIntentProcessData.mockResolvedValue({
      model: { intent: { logIndex: 2, vmType: 'SVM' } },
    } as any)

    mockFetchRaw.mockResolvedValue({
      status: 1,
      tokens_funded: 1,
      native_funded: 1,
      reward: { deadline: Date.now() / 1000 + 3600 },
      route: { destination_domain_id: 1 },
    })

    const ok = await service.validateIntent(intentHash)
    expect(ok).toBe(true)

    expect(mockAddJob).toHaveBeenCalledWith(
      QUEUES.SOLANA_INTENT.jobs.feasable_intent,
      intentHash,
      expect.objectContaining({ jobId: expect.any(String) }),
    )
  })
})
