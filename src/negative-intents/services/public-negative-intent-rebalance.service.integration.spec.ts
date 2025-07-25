import { DBTestUtils } from '@/common/test-utils/db-test-utils'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { getQueueToken } from '@nestjs/bullmq'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'
import { IntentSourceModel, IntentSourceSchema } from '@/intent/schemas/intent-source.schema'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { NegativeIntentAnalyzerService } from '@/negative-intents/services/negative-intents-analyzer.service'
import { PublicNegativeIntentRebalanceService } from './public-negative-intent-rebalance.service'
import { Queue } from 'bullmq'
import { QUEUES } from '@/common/redis/constants'
import { RewardDataModel } from '@/intent/schemas/reward-data.schema'
import { RouteDataModel } from '@/intent/schemas/route-data.schema'
import { TokenData } from '@/liquidity-manager/types/types'

function createTestingIntentModel(
  options: {
    status?: IntentSourceModel['status']
    intentOverrides?: Partial<IntentDataModel>
    routeOverrides?: Partial<RouteDataModel>
    rewardOverrides?: Partial<RewardDataModel>
  } = {},
): IntentSourceModel {
  const {
    status = 'PENDING',
    intentOverrides = {},
    routeOverrides = {},
    rewardOverrides = {},
  } = options

  return {
    status,
    intent: {
      hash: '0xHASH',
      logIndex: 0,
      route: {
        salt: '0xSALT',
        source: 1n,
        destination: 10n,
        inbox: '0xINBOX',
        tokens: [{ token: '0xInputToken', amount: 2000n }],
        calls: [
          {
            target: '0xInputToken',
            data: '0xa9059cbb000000000000000000000000054968e2f376192c69b8f30870d450519ff77ac8000000000000000000000000000000000000000000000000000000000001adb0',
            value: 0n,
          },
        ],
        ...routeOverrides,
      },
      reward: {
        creator: '0xCREATOR',
        prover: '0xPROVER',
        deadline: BigInt(Date.now() + 60_000),
        nativeValue: 0n,
        tokens: [{ token: '0xOutputToken', amount: 1700n }],
        ...rewardOverrides,
      },
      ...intentOverrides,
    },
  } as any
}

const tokenIn: TokenData = {
  chainId: 1,
  config: {
    address: '0xInputToken',
    chainId: 1,
    minBalance: 0,
    targetBalance: 0,
    type: 'erc20',
  },
  balance: {
    address: '0xInputToken',
    decimals: 18,
    balance: 1000n,
  },
}

const tokenOut: TokenData = {
  chainId: 10,
  config: {
    address: '0xOutputToken',
    chainId: 10,
    minBalance: 0,
    targetBalance: 0,
    type: 'erc20',
  },
  balance: {
    address: '0xOutputToken',
    decimals: 18,
    balance: 1000n,
  },
}

export const mockQueue = {
  add: jest.fn(),
} as unknown as Queue

describe('PublicNegativeIntentRebalanceService', () => {
  let $: EcoTester
  let dbTestUtils: DBTestUtils
  let intentSourceRepository: IntentSourceRepository
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
    EcoLogger.setLoggingForUnitTests()
    dbTestUtils = new DBTestUtils()
    await dbTestUtils.dbOpen()

    $ = EcoTester.setupTestFor(PublicNegativeIntentRebalanceService)
      .withProviders([
        EcoConfigService,
        IntentSourceRepository,
        NegativeIntentAnalyzerService,
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
      .withSchemas([[IntentSourceModel.name, IntentSourceSchema]])
      .overridingProvider(EcoConfigService)
      .useFactory(() => new EcoConfigService([mockSource as any]))

    service = await $.init<PublicNegativeIntentRebalanceService>()
    intentSourceRepository = $.get(IntentSourceRepository)
  })

  afterAll(async () => {
    await dbTestUtils.dbClose()
  })

  afterEach(async () => {
    jest.restoreAllMocks()
  })

  it('get quotes', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({ status: 'PENDING' }),
      createTestingIntentModel({ status: 'INFEASABLE' }),
    ])

    const quote = await service.getQuote(tokenIn, tokenOut, 1000)
    expect(quote).toBeDefined()
  })
})
