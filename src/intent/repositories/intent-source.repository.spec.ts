import { DBTestUtils } from '@/common/test-utils/db-test-utils'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { IntentSourceModel, IntentSourceSchema } from '@/intent/schemas/intent-source.schema'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { RewardDataModel } from '@/intent/schemas/reward-data.schema'
import { RouteDataModel } from '@/intent/schemas/route-data.schema'

const TransferSelector = '0xa9059cbb' // ERC20 transfer function selector

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
        tokens: [],
        calls: [],
        ...routeOverrides,
      },
      reward: {
        creator: '0xCREATOR',
        prover: '0xPROVER',
        deadline: BigInt(Date.now() + 60_000),
        nativeValue: 0n,
        tokens: [],
        ...rewardOverrides,
      },
      ...intentOverrides,
    },
  } as any
}

describe('IntentSourceRepository', () => {
  let $: EcoTester
  let dbTestUtils: DBTestUtils
  let intentSourceRepository: IntentSourceRepository

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
    dbTestUtils = new DBTestUtils()
    await dbTestUtils.dbOpen()

    $ = EcoTester.setupTestFor(IntentSourceRepository)
      .withProviders([])
      .withMocks([])
      .withSchemas([[IntentSourceModel.name, IntentSourceSchema]])
      .overridingProvider(EcoConfigService)
      .useFactory(() => new EcoConfigService([mockSource as any]))

    intentSourceRepository = await $.init<IntentSourceRepository>()
  })

  afterAll(async () => {
    await dbTestUtils.dbClose()
  })

  beforeEach(async () => {
    await intentSourceRepository.deleteMany({})
  })

  it('filters by single status', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({ status: 'PENDING' }),
      createTestingIntentModel({ status: 'INFEASABLE' }),
    ])

    const res = await intentSourceRepository.filterIntents({ status: 'PENDING' })
    expect(res).toHaveLength(1)
    expect(res[0].status).toBe('PENDING')
  })

  it('filters by multiple status values', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({ status: 'PENDING' }),
      createTestingIntentModel({ status: 'INFEASABLE' }),
      createTestingIntentModel({ status: 'SOLVED' }),
    ])

    const res = await intentSourceRepository.filterIntents({ status: ['INFEASABLE', 'SOLVED'] })
    expect(res).toHaveLength(2)
  })

  it('filters by non-expired intents', async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000)

    await intentSourceRepository.insertMany([
      createTestingIntentModel({
        rewardOverrides: { deadline: BigInt(nowInSeconds + 60) },
      }),
      createTestingIntentModel({
        rewardOverrides: { deadline: BigInt(nowInSeconds - 1) },
      }),
    ])

    const res = await intentSourceRepository.filterIntents({ requireNonExpired: true })
    expect(res).toHaveLength(1)
  })

  it('filters by createdAfter', async () => {
    const oneHourAgo = new Date(Date.now() - 3600_000)
    const tenSecondsAgo = new Date(Date.now() - 10_000)

    const older = createTestingIntentModel()
    const newer = createTestingIntentModel()

    Object.assign(older, { createdAt: oneHourAgo })
    Object.assign(newer, { createdAt: tenSecondsAgo })

    await intentSourceRepository.insertMany([older, newer])

    const res = await intentSourceRepository.filterIntents({
      createdAfter: new Date(Date.now() - 30_000),
    })

    expect(res).toHaveLength(1)
    expect(res[0].createdAt!.getTime()).toBeGreaterThan(Date.now() - 30_000)
  })

  it('filters by createdBefore', async () => {
    const oneHourAgo = new Date(Date.now() - 3600_000)
    const tenSecondsAgo = new Date(Date.now() - 10_000)

    const older = createTestingIntentModel()
    const newer = createTestingIntentModel()

    Object.assign(older, { createdAt: oneHourAgo })
    Object.assign(newer, { createdAt: tenSecondsAgo })

    await intentSourceRepository.insertMany([older, newer])

    const res = await intentSourceRepository.filterIntents({
      createdBefore: new Date(Date.now() - 30_000),
    })

    expect(res).toHaveLength(1)
    expect(res[0].createdAt!.getTime()).toBeLessThan(Date.now() - 30_000)
  })

  it('filters by route token', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({
        routeOverrides: { tokens: [{ token: '0xAA', amount: 1n }] },
      }),
      createTestingIntentModel({
        routeOverrides: { tokens: [{ token: '0xBB', amount: 1n }] },
      }),
    ])

    const res = await intentSourceRepository.filterIntents({ routeToken: '0xAA' })
    expect(res).toHaveLength(1)
  })

  it('filters by reward token', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({
        rewardOverrides: { tokens: [{ token: '0xAA', amount: 1n }] },
      }),
      createTestingIntentModel({
        rewardOverrides: { tokens: [{ token: '0xBB', amount: 1n }] },
      }),
    ])

    const res = await intentSourceRepository.filterIntents({ rewardToken: '0xAA' })
    expect(res).toHaveLength(1)
  })

  it('filters by single call and target match', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({
        routeOverrides: { calls: [{ target: '0xT1', data: '0x1234', value: 0n }] },
      }),
      createTestingIntentModel({
        routeOverrides: { calls: [{ target: '0xT2', data: '0x1234', value: 0n }] },
      }),
    ])

    const res = await intentSourceRepository.filterIntents({ callTarget: '0xT1' })
    expect(res).toHaveLength(1)
  })

  it('filters for calls with ERC20 transfer selector', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({
        routeOverrides: { calls: [{ target: '0xT1', data: TransferSelector, value: 0n }] },
      }),
      createTestingIntentModel({
        routeOverrides: { calls: [{ target: '0xT2', data: '0xabcdef12', value: 0n }] },
      }),
    ])

    const res = await intentSourceRepository.filterIntents({ requireTransferSelector: true })
    expect(res).toHaveLength(1)
  })

  it('filters for calls with zero call value', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({
        routeOverrides: { calls: [{ target: '0xT1', data: '0x00', value: 0n }] },
      }),
      createTestingIntentModel({
        routeOverrides: { calls: [{ target: '0xT2', data: '0x00', value: 1n }] },
      }),
    ])

    const res = await intentSourceRepository.filterIntents({ requireZeroCallValue: true })
    expect(res).toHaveLength(1)
  })

  it('returns no match if routeToken and rewardToken do not intersect', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({
        routeOverrides: { tokens: [{ token: '0xROUTE1', amount: 1n }] },
        rewardOverrides: { tokens: [{ token: '0xREWARD1', amount: 1n }] },
      }),
    ])

    const res = await intentSourceRepository.filterIntents({
      routeToken: '0xROUTE2',
      rewardToken: '0xREWARD2',
    })

    expect(res).toHaveLength(0)
  })

  it('returns full match when all filters satisfied', async () => {
    await intentSourceRepository.insertMany([
      createTestingIntentModel({
        status: 'PENDING',
        routeOverrides: {
          tokens: [{ token: '0xTOK', amount: 1n }],
          calls: [{ target: '0xTARGET', data: TransferSelector, value: 0n }],
        },
        rewardOverrides: {
          tokens: [{ token: '0xREWARD', amount: 1n }],
          deadline: BigInt(Date.now() + 60_000),
        },
      }),
    ])

    const res = await intentSourceRepository.filterIntents({
      status: 'PENDING',
      routeToken: '0xTOK',
      rewardToken: '0xREWARD',
      requireNonExpired: true,
      callTarget: '0xTARGET',
      requireTransferSelector: true,
      requireZeroCallValue: true,
    })

    expect(res).toHaveLength(1)
  })

  it('returns unfulfilled intents matching status and token filters', async () => {
    const valid = createTestingIntentModel({
      status: 'PENDING',
      routeOverrides: {
        tokens: [{ token: '0xROUTE', amount: 100n }],
        calls: [
          {
            target: '0xTARGET',
            data: TransferSelector, // matches ERC20 transfer
            value: 0n,
          },
        ],
      },
      rewardOverrides: {
        tokens: [{ token: '0xREWARD', amount: 100n }],
        deadline: BigInt(Date.now() + 60_000), // in future
      },
    })

    const expired = createTestingIntentModel({
      status: 'PENDING',
      routeOverrides: {
        tokens: [{ token: '0xROUTE', amount: 200n }],
        calls: [],
      } as unknown as RouteDataModel,
      rewardOverrides: {
        tokens: [{ token: '0xREWARD', amount: 200n }],
        deadline: BigInt(Date.now() - 1000), // expired
      } as unknown as RewardDataModel,
    })

    await intentSourceRepository.insertMany([valid, expired])

    const results = await intentSourceRepository.filterIntents({
      status: 'PENDING',
      routeToken: '0xROUTE',
      rewardToken: '0xREWARD',
      requireNonExpired: true,
      callTarget: '0xTARGET',
      requireTransferSelector: true,
      requireZeroCallValue: true,
    })

    expect(results).toHaveLength(1)
    expect(results[0].intent.route.tokens[0].token).toBe('0xROUTE')
  })
})
