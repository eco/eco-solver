import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { NegativeIntentAnalyzerService } from '@/negative-intents/services/negative-intents-analyzer.service'

const logger = new EcoLogger('NegativeIntentAnalyzerServiceSpec')

function makeIntent({
  rewardAmount,
  routeAmount,
  calldata = '0xa9059cbb' + '0'.repeat(64) + '0'.repeat(64),
}: {
  rewardAmount: bigint
  routeAmount: bigint
  calldata?: string
}): IntentSourceModel {
  return {
    status: 'PENDING',
    intent: {
      hash: '0xHASH',
      logIndex: 0,
      route: {
        salt: '0xSALT',
        source: 1n,
        destination: 10n,
        inbox: '0xINBOX',
        tokens: [{ token: '0xTOKEN', amount: routeAmount }],
        calls: [{ target: '0xTOKEN', data: calldata as any, value: 0n }],
      },
      reward: {
        creator: '0xCREATOR',
        prover: '0xPROVER',
        deadline: BigInt(Date.now() + 60_000),
        nativeValue: 0n,
        tokens: [{ token: '0xTOKEN', amount: rewardAmount }],
      },
    },
  } as any
}

describe('NegativeIntentAnalyzerService', () => {
  let $: EcoTester
  let analyzer: NegativeIntentAnalyzerService

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
  }

  beforeAll(async () => {
    $ = EcoTester.setupTestFor(NegativeIntentAnalyzerService)
      .withProviders([EcoConfigService])
      .withMocks([])
      .overridingProvider(EcoConfigService)
      .useFactory(() => new EcoConfigService([mockSource as any]))

    analyzer = await $.init<NegativeIntentAnalyzerService>()
  })

  it('analyzes negative vs non-negative intents correctly', () => {
    const negative = makeIntent({ rewardAmount: 80n, routeAmount: 100n })
    const positive = makeIntent({ rewardAmount: 120n, routeAmount: 100n })

    expect(analyzer.analyzeIntent(negative).response!.isNegative).toBe(true)
    expect(analyzer.analyzeIntent(positive).response!.isNegative).toBe(false)
  })

  it('ranks intents by slippage and output correctly', () => {
    const intents = [
      makeIntent({ rewardAmount: 90n, routeAmount: 100n }), // 10% slippage
      makeIntent({ rewardAmount: 80n, routeAmount: 100n }), // 20% slippage
      makeIntent({ rewardAmount: 70n, routeAmount: 100n }), // 30% slippage (should be skipped)
      makeIntent({ rewardAmount: 90n, routeAmount: 110n }), // ~18.18% slippage
    ]

    const result = analyzer.rankIntents(intents, 0.2)

    logger.error(
      EcoLogMessage.fromDefault({
        message: `ranks intents by slippage and output correctly`,
        properties: {
          results: result.ranked.map((i) => {
            return {
              slippage: i.slippage,
              rewardAmount: i.rewardAmount,
              routeAmount: i.routeAmount,
              netDiff: i.netDiff,
            }
          }),
        },
      }),
    )

    expect(result.ranked).toHaveLength(3)
    expect(result.ranked[0].slippage).toBeCloseTo(0.1)
    expect(result.ranked[1].slippage).toBeCloseTo(0.1818, 2)
    expect(result.ranked[2].slippage).toBeCloseTo(0.2)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toContain('Slippage too high')
  })

  it('ranks intents with same slippage by higher reward amount', () => {
    // Both have 20% slippage: reward 80/100 and 160/200
    const intentA = makeIntent({ rewardAmount: 80n, routeAmount: 100n })
    const intentB = makeIntent({ rewardAmount: 160n, routeAmount: 200n })

    const result = analyzer.rankIntents([intentA, intentB], 0.3)

    expect(result.ranked).toHaveLength(2)
    expect(result.ranked[0].rewardAmount).toBe(160n)
    expect(result.ranked[1].rewardAmount).toBe(80n)
  })

  it('skips intent when slippage exceeds threshold', () => {
    const badSlippage = makeIntent({ rewardAmount: 50n, routeAmount: 100n }) // 50% slippage
    const result = analyzer.rankIntents([badSlippage], 0.2) // 20% max allowed
    expect(result.ranked).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].reason).toContain('Slippage too high')
  })

  it('skips intent with invalid calldata', () => {
    const invalidSelector = '0xdeadbeef' + '0'.repeat(128) // total = 138 chars
    const badCall = makeIntent({ rewardAmount: 90n, routeAmount: 100n, calldata: invalidSelector })
    const result = analyzer.rankIntents([badCall])
    expect(result.ranked).toHaveLength(0)
    expect(result.skipped[0].reason).toContain('Call data is not a transfer')
  })
})
