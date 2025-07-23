import { CreateIntentService } from '@/intent/create-intent.service'
import { createMock } from '@golevelup/ts-jest'
import { EcoAnalyticsService } from '@/analytics'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { getModelToken } from '@nestjs/mongoose'
import { IntentFundedEventModel } from '@/watch/intent/intent-funded-events/schemas/intent-funded-events.schema'
import { IntentFundedEventRepository } from '@/watch/intent/intent-funded-events/repositories/intent-funded-event.repository'
import { IntentFundedLog } from '@/contracts'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { Network } from '@/common/alchemy/network'
import { PublicClient } from 'viem'
import { QUEUES } from '@/common/redis/constants'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRepository } from '@/quote/quote.repository'
import { WatchIntentFundedService } from '@/watch/intent/intent-funded-events/services/watch-intent-funded.service'

let $: EcoTester
let service: WatchIntentFundedService
let ecoConfigService: EcoConfigService
let publicClientService: MultichainPublicClientService

describe('WatchIntentFundedService', () => {
  const mockDb: any[] = []

  const mockIntentFundedEventModel = {
    create: jest.fn(async (doc) => {
      mockDb.push(doc)
      return doc
    }),
    findOne: jest.fn(async (query) => {
      return mockDb.find((doc) => doc.transactionHash === query.transactionHash)
    }),
  }

  const mockQuoteIntentModel = {
    create: jest.fn(async (doc) => {
      mockDb.push(doc)
      return doc
    }),
    findOne: jest.fn(async (query) => {
      return mockDb.find((doc) => doc.transactionHash === query.transactionHash)
    }),
  }

  beforeAll(async () => {
    const mockSource = {
      getConfig: () => ({
        'IntentSource.1': '0x0000000000000000000000000000000000000001',
        'Prover.1': '0x0000000000000000000000000000000000000002',
        'HyperProver.1': '0x0000000000000000000000000000000000000003',
        'Inbox.1': '0x0000000000000000000000000000000000000004',
        intentSources: [
          {
            chainID: 10,
            sourceAddress: '0x0000000000000000000000000000000000000001',
            provers: ['0x0000000000000000000000000000000000000002'],
            network: 'mainnet',
            inbox: '0x0000000000000000000000000000000000000004',
            hyperProver: '0x0000000000000000000000000000000000000003',
            tokens: ['0x000000000000000000000000000000000000dead'], // ← ✅ required to avoid map() crash
          },
        ],
        rpcs: {
          keys: {
            '0x1234': '0x1234',
          },
        },
        eth: {
          pollingInterval: 1000,
        },
      }),
    }

    $ = EcoTester.setupTestFor(WatchIntentFundedService)
      .withProviders([
        IntentFundedEventRepository,
        {
          provide: getModelToken(IntentFundedEventModel.name),
          useValue: mockIntentFundedEventModel,
        },
        QuoteRepository,
        {
          provide: getModelToken(QuoteIntentModel.name),
          useValue: mockQuoteIntentModel,
        },
        {
          provide: EcoConfigService, // ⬅ inject the actual mocked provider here
          useValue: new EcoConfigService([mockSource as any]),
        },
      ])
      .withMocks([CreateIntentService, MultichainPublicClientService, EcoAnalyticsService])
      .withQueues([QUEUES.SOURCE_INTENT.queue])

    service = await $.init()
    ecoConfigService = $.get(EcoConfigService)
    publicClientService = $.get(MultichainPublicClientService)
  })

  beforeEach(async () => {
    mockDb.length = 0
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(async () => {})

  it('subscribes to configured sources', async () => {
    const fakeClient = createMock<PublicClient>()

    jest.spyOn(publicClientService, 'getClient').mockResolvedValue(fakeClient)

    const sources = [
      { chainID: 10, sourceAddress: '0xabc', provers: ['0x1'], network: Network.ETH_MAINNET },
    ] as unknown[] as IntentSource[]

    jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue(sources)
    await service.subscribe()
    expect(fakeClient.watchContractEvent).toHaveBeenCalled()
  })

  it('saves to mongo and enqueues the job', async () => {
    const log: IntentFundedLog = {
      address: '0xabc',
      blockHash: '0xblock',
      blockNumber: 123n,
      logIndex: 0,
      transactionHash: '0xtx',
      transactionIndex: 1,
      data: '0x', // <-- required, even if empty
      removed: false, // <-- required
      topics: [], // <-- required
      eventName: 'IntentFunded',
      sourceNetwork: Network.ETH_MAINNET, // <-- required for your code
      sourceChainID: 1n, // <-- required for your code
      args: {
        intentHash: '0xintent',
        funder: '0x1',
      },
    }

    const source = {
      chainID: 10,
      sourceAddress: '0xabc',
      provers: ['0x1'],
      network: 'mainnet',
    } as unknown as IntentSource

    const addJob = service['addJob'](source)
    await addJob([log])

    const saved = await mockIntentFundedEventModel.findOne({ transactionHash: '0xtx' })
    expect(saved).toBeDefined()
    expect(saved?.args.intentHash).toBe('0xintent')

    expect($.mockOfQueue(QUEUES.SOURCE_INTENT.queue).add).toHaveBeenCalled()
  })

  it('resubscribes successfully after unsubscribe', async () => {
    jest.clearAllMocks()
    const fakeClient = createMock<PublicClient>()

    jest.spyOn(publicClientService, 'getClient').mockResolvedValue(fakeClient)

    const sources = [
      { chainID: 10, sourceAddress: '0xabc', provers: ['0x1'], network: 'mainnet' },
    ] as unknown[] as IntentSource[]

    jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue(sources)
    await service.subscribe()
    await service.unsubscribe()
    await service.subscribe()
    expect(publicClientService.getClient).toHaveBeenCalledTimes(2)
  })

  it('processes replayed logs via onLogs', async () => {
    const fakeClient = createMock<PublicClient>()
    const emittedLogs: IntentFundedLog[] = [
      {
        address: '0xabc',
        blockHash: '0xblock',
        blockNumber: 1n,
        logIndex: 0,
        transactionHash: '0xtxhash',
        transactionIndex: 0,
        data: '0x', // <-- required, even if empty
        removed: false, // <-- required
        topics: [], // <-- required
        eventName: 'IntentFunded',
        sourceNetwork: Network.ETH_MAINNET, // <-- required for your code
        sourceChainID: 1n, // <-- required for your code
        args: {
          intentHash: '0xintent123',
          funder: '0x1',
        },
      },
    ]

    let onLogsFn: (logs: IntentFundedLog[]) => Promise<void> = async () => {}

    fakeClient.watchContractEvent.mockImplementation(({ onLogs }) => {
      onLogsFn = onLogs as (logs: IntentFundedLog[]) => Promise<void>
      return () => {} // return unsubscribe fn
    })

    jest.spyOn(publicClientService, 'getClient').mockResolvedValue(fakeClient)

    const sources = [
      { chainID: 10, sourceAddress: '0xabc', provers: ['0x1'], network: 'mainnet' },
    ] as unknown[] as IntentSource[]

    jest.spyOn(ecoConfigService, 'getIntentSources').mockReturnValue(sources)

    // 👇 Mock isOurIntent to return true
    jest.spyOn(service as any, 'isOurIntent').mockResolvedValueOnce(true)

    await service.subscribe()
    await onLogsFn!(emittedLogs)

    const saved = await mockIntentFundedEventModel.findOne({ transactionHash: '0xtxhash' })
    expect(saved).toBeDefined()
    expect($.mockOfQueue(QUEUES.SOURCE_INTENT.queue).add).toHaveBeenCalledWith(
      QUEUES.SOURCE_INTENT.jobs.validate_intent,
      { intentHash: '0xintent123' },
      expect.any(Object),
    )
  })

  it('skips logs when doValidation is true and isOurIntent returns false', async () => {
    const source = {
      chainID: 10,
      sourceAddress: '0xabc',
      provers: ['0x1'],
      network: 'mainnet',
    } as unknown as IntentSource

    const log: IntentFundedLog = {
      address: '0xabc',
      blockHash: '0xblock',
      blockNumber: 123n,
      logIndex: 0,
      transactionHash: '0xskipme',
      transactionIndex: 0,
      data: '0x',
      removed: false,
      topics: [],
      eventName: 'IntentFunded',
      sourceNetwork: Network.ETH_MAINNET,
      sourceChainID: 1n,
      args: {
        intentHash: '0xnotours',
        funder: '0x1',
      },
    }

    // 👇 Mock isOurIntent to return false
    jest.spyOn(service as any, 'isOurIntent').mockResolvedValueOnce(false)

    const addJob = service['addJob'](source, { doValidation: true })
    await addJob([log])

    const saved = await mockIntentFundedEventModel.findOne({ transactionHash: '0xskipme' })
    expect(saved).toBeUndefined()
    expect($.mockOfQueue(QUEUES.SOURCE_INTENT.queue).add).not.toHaveBeenCalled()
  })

  it('processes logs when doValidation is true and isOurIntent returns true', async () => {
    const source = {
      chainID: 10,
      sourceAddress: '0xabc',
      provers: ['0x1'],
      network: 'mainnet',
    } as unknown as IntentSource

    const log: IntentFundedLog = {
      address: '0xabc',
      blockHash: '0xblock',
      blockNumber: 456n,
      logIndex: 1,
      transactionHash: '0xprocessthis',
      transactionIndex: 0,
      data: '0x',
      removed: false,
      topics: [],
      eventName: 'IntentFunded',
      sourceNetwork: Network.ETH_MAINNET,
      sourceChainID: 1n,
      args: {
        intentHash: '0xours',
        funder: '0x1',
      },
    }

    // 👇 Mock isOurIntent to return true
    jest.spyOn(service as any, 'isOurIntent').mockResolvedValueOnce(true)

    const addJob = service['addJob'](source, { doValidation: true })
    await addJob([log])

    const saved = await mockIntentFundedEventModel.findOne({ transactionHash: '0xprocessthis' })
    expect(saved).toBeDefined()
    expect(saved?.args.intentHash).toBe('0xours')

    expect($.mockOfQueue(QUEUES.SOURCE_INTENT.queue).add).toHaveBeenCalledWith(
      QUEUES.SOURCE_INTENT.jobs.validate_intent,
      { intentHash: '0xours' },
      expect.objectContaining({
        jobId: expect.any(String),
      }),
    )
  })

  it('processes only valid logs when doValidation is true', async () => {
    const source = {
      chainID: 10,
      sourceAddress: '0xabc',
      provers: ['0x1'],
      network: 'mainnet',
    } as unknown as IntentSource

    const logs: IntentFundedLog[] = [
      {
        address: '0xabc',
        blockHash: '0xblock1',
        blockNumber: 1n,
        logIndex: 0,
        transactionHash: '0xvalid1',
        transactionIndex: 0,
        data: '0x',
        removed: false,
        topics: [],
        eventName: 'IntentFunded',
        sourceNetwork: Network.ETH_MAINNET,
        sourceChainID: 1n,
        args: {
          intentHash: '0xvalidIntent1',
          funder: '0x1',
        },
      },
      {
        address: '0xabc',
        blockHash: '0xblock2',
        blockNumber: 2n,
        logIndex: 1,
        transactionHash: '0xinvalid',
        transactionIndex: 0,
        data: '0x',
        removed: false,
        topics: [],
        eventName: 'IntentFunded',
        sourceNetwork: Network.ETH_MAINNET,
        sourceChainID: 1n,
        args: {
          intentHash: '0xinvalidIntent',
          funder: '0x1',
        },
      },
      {
        address: '0xabc',
        blockHash: '0xblock3',
        blockNumber: 3n,
        logIndex: 2,
        transactionHash: '0xvalid2',
        transactionIndex: 0,
        data: '0x',
        removed: false,
        topics: [],
        eventName: 'IntentFunded',
        sourceNetwork: Network.ETH_MAINNET,
        sourceChainID: 1n,
        args: {
          intentHash: '0xvalidIntent2',
          funder: '0x1',
        },
      },
    ]

    // 👇 Simulate validation: only the 2 valid intent hashes should pass
    const isOurIntentMock = jest
      .spyOn(service as any, 'isOurIntent')
      .mockImplementation(async (log: IntentFundedLog) => {
        return log.args.intentHash !== '0xinvalidIntent'
      })

    const addJob = service['addJob'](source, { doValidation: true })
    await addJob(logs)

    // ⛳ Only the 2 valid logs should be saved
    const valid1 = await mockIntentFundedEventModel.findOne({ transactionHash: '0xvalid1' })
    const valid2 = await mockIntentFundedEventModel.findOne({ transactionHash: '0xvalid2' })
    const invalid = await mockIntentFundedEventModel.findOne({ transactionHash: '0xinvalid' })

    expect(valid1).toBeDefined()
    expect(valid2).toBeDefined()
    expect(invalid).toBeUndefined()

    // 🧾 The queue should only be called for the valid logs
    const queue = $.mockOfQueue(QUEUES.SOURCE_INTENT.queue).add
    expect(queue).toHaveBeenCalledTimes(2)
    expect(queue).toHaveBeenCalledWith(
      QUEUES.SOURCE_INTENT.jobs.validate_intent,
      { intentHash: '0xvalidIntent1' },
      expect.any(Object),
    )
    expect(queue).toHaveBeenCalledWith(
      QUEUES.SOURCE_INTENT.jobs.validate_intent,
      { intentHash: '0xvalidIntent2' },
      expect.any(Object),
    )
  })
})
