import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { getQueueToken } from '@nestjs/bullmq'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { NegativeIntentAnalyzerService } from '@/negative-intents/services/negative-intents-analyzer.service'
import { PublicNegativeIntentRebalanceService } from './public-negative-intent-rebalance.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { RankedIntent } from '@/negative-intents/services/negative-intents-analyzer.service'
import { TokenData } from '@/liquidity-manager/types/types'

const mockIntentSourceModel = {
  intent: {
    hash: '0xabc',
    logIndex: 0,
    route: {
      salt: '0xSALT',
      source: 1n,
      destination: 10n,
      inbox: '0xINBOX',
      tokens: [{ token: '0xTOKEN', amount: 1000n }],
    },
    reward: {
      creator: '0xCREATOR',
      prover: '0xPROVER',
      deadline: BigInt(Date.now() + 60_000),
      nativeValue: 0n,
      tokens: [{ token: '0xTOKEN', amount: 900n }],
    },
  },
} as unknown as IntentSourceModel

const mockIntent: RankedIntent = {
  intentSource: mockIntentSourceModel,
  routeAmount: 1000n,
  rewardAmount: 900n,
} as RankedIntent

const mockTokenData: TokenData = {
  chainId: 1,
  config: {
    address: '0xToken',
    chainId: 1,
    minBalance: 0,
    targetBalance: 0,
    type: 'erc20',
  },
  balance: {
    address: '0xToken',
    decimals: 18,
    balance: 1000n,
  },
}

export const mockQueue = {
  add: jest.fn(),
} as unknown as Queue

describe('PublicNegativeIntentRebalanceService', () => {
  let $: EcoTester
  let service: PublicNegativeIntentRebalanceService

  const mockSource = {
    getConfig: () => ({
      'IntentSource.1': '0x0000000000000000000000000000000000000001',
      'Prover.1': '0x0000000000000000000000000000000000000002',
      'HyperProver.1': '0x0000000000000000000000000000000000000003',
      'Inbox.1': '0x0000000000000000000000000000000000000004',
      rpcs: {
        keys: {
          '0x1234': '0x1234',
        },
      },
      alchemy: {
        networks: [{ id: 1 }, { id: 137 }],
        apiKey: 'fake-alchemy-api-key',
      },
      eth: {
        pollingInterval: 1000,
      },
    }),
    getRedis: () => ({ jobs: { intentJobConfig: {} } }),
  }

  beforeAll(async () => {
    $ = EcoTester.setupTestFor(PublicNegativeIntentRebalanceService)
      .withProviders([
        EcoConfigService,
        {
          provide: NegativeIntentAnalyzerService,
          useValue: {
            rankIntents: jest.fn().mockReturnValue({ ranked: [mockIntent] }),
            getSlippage: jest.fn().mockReturnValue(0.01),
            analyzeIntent: jest
              .fn()
              .mockReturnValue({ response: { isNegative: true }, error: null }),
          },
        },
        {
          provide: IntentSourceRepository,
          useValue: {
            filterIntents: jest.fn().mockResolvedValue([mockIntent.intentSource]),
            getIntent: jest.fn().mockResolvedValue(mockIntentSourceModel),
          },
        },
        {
          provide: IntentProcessorService,
          useValue: {
            addExecuteWithdrawalsJob: jest.fn().mockResolvedValue({ id: 'job123' }),
          },
        },
        {
          provide: getQueueToken(QUEUES.SOURCE_INTENT.queue),
          useValue: mockQueue,
        },
      ])
      .withMocks([])
      .overridingProvider(EcoConfigService)
      .useFactory(() => new EcoConfigService([mockSource as any]))

    service = await $.init<PublicNegativeIntentRebalanceService>()
  })

  afterEach(async () => {
    jest.restoreAllMocks()
  })

  it('should return strategy name', () => {
    expect(service.getStrategy()).toEqual('PublicNegativeIntent')
  })

  it('should return empty quote when no intents are found', async () => {
    jest.spyOn($.get(IntentSourceRepository), 'filterIntents').mockResolvedValue([])
    const quote = await service.getQuote(mockTokenData, mockTokenData, 1000)
    expect(quote).toEqual([])
  })

  it('should return a valid quote with ranked intents', async () => {
    const quote = await service.getQuote(mockTokenData, mockTokenData, 1000)

    if (Array.isArray(quote)) {
      for (const q of quote) {
        expect(q).toHaveProperty('amountIn')
        expect(q).toHaveProperty('amountOut')
        expect(q.strategy).toEqual('PublicNegativeIntent')
      }
    } else {
      expect(quote).toHaveProperty('amountIn')
      expect(quote).toHaveProperty('amountOut')
      expect(quote.strategy).toEqual('PublicNegativeIntent')
    }
  })

  it('should skip if intent not found in execute', async () => {
    jest.spyOn($.get(IntentSourceRepository), 'getIntent').mockResolvedValue(null)

    const { response: numFulfilled, error } = await service.execute('0xwallet', {
      tokenIn: mockTokenData,
      tokenOut: mockTokenData,
      amountIn: 1000n,
      amountOut: 900n,
      slippage: 0.01,
      strategy: 'PublicNegativeIntent',
      context: { intentHashes: ['0xdead'] },
    })

    expect(error).not.toBeDefined()
    expect(numFulfilled).toEqual(1)
  })

  it('should call addExecuteWithdrawalsJob if intent is negative', async () => {
    const intentHash = '0xabc'
    const intentRepo = $.get(IntentSourceRepository)
    jest.spyOn(intentRepo, 'getIntent').mockResolvedValue(mockIntentSourceModel)
    await service.processIntentProven({ intentHash })

    const intentProcessorService = $.get<IntentProcessorService>(IntentProcessorService)
    expect(intentProcessorService.addExecuteWithdrawalsJob).toHaveBeenCalled()
  })
})
