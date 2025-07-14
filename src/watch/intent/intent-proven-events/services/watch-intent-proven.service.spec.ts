import { CreateIntentService } from '@/intent/create-intent.service'
import { createMock } from '@golevelup/ts-jest'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { Hex, PublicClient } from 'viem'
import { IntentProvenLog } from '@/contracts'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { Network } from '@/common/alchemy/network'
import {
  Prover,
  WatchIntentProvenService,
} from '@/watch/intent/intent-proven-events/services/watch-intent-proven.service'
import { QUEUES } from '@/common/redis/constants'

let $: EcoTester
let service: WatchIntentProvenService
let ecoConfigService: EcoConfigService
let publicClientService: MultichainPublicClientService

function mockTopics(): [`0x${string}`, `0x${string}`, `0x${string}`] {
  return [
    ('0x' + 'a'.repeat(64)) as Hex,
    ('0x' + 'b'.repeat(64)) as Hex,
    ('0x' + 'c'.repeat(64)) as Hex,
  ]
}

describe('WatchIntentProvenService', () => {
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

    $ = EcoTester.setupTestFor(WatchIntentProvenService)
      .withProviders([
        {
          provide: EcoConfigService, // ⬅ inject the actual mocked provider here
          useValue: new EcoConfigService([mockSource as any]),
        },
      ])
      .withMocks([CreateIntentService, MultichainPublicClientService])
      .withQueues([QUEUES.SOURCE_INTENT.queue])

    service = await $.init()
    ecoConfigService = $.get(EcoConfigService)
    publicClientService = $.get(MultichainPublicClientService)
  })

  beforeEach(async () => {})

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

  it('enqueues the job', async () => {
    const log: IntentProvenLog = {
      address: '0xabc',
      blockHash: '0xblock',
      blockNumber: 123n,
      logIndex: 0,
      transactionHash: '0xtx',
      transactionIndex: 1,
      data: '0x', // <-- required, even if empty
      removed: false, // <-- required
      topics: mockTopics(), // <-- required
      eventName: 'IntentProven',
      sourceNetwork: Network.ETH_MAINNET, // <-- required for your code
      sourceChainID: 1n, // <-- required for your code
      args: {
        _hash: '0xintent',
        _claimant: '0x1',
      },
    }

    const prover = {
      network: 'mainnet',
      chainID: 10,
      proverAddress: '0xabc',
    } as unknown as Prover

    const addJob = service['addJob'](prover)
    await addJob([log])

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
    const emittedLogs: IntentProvenLog[] = [
      {
        address: '0xabc',
        blockHash: '0xblock',
        blockNumber: 1n,
        logIndex: 0,
        transactionHash: '0xtxhash',
        transactionIndex: 0,
        data: '0x', // <-- required, even if empty
        removed: false, // <-- required
        topics: mockTopics(), // <-- required
        eventName: 'IntentProven',
        sourceNetwork: Network.ETH_MAINNET, // <-- required for your code
        sourceChainID: 1n, // <-- required for your code
        args: {
          _hash: '0xintent123',
          _claimant: '0x1',
        },
      },
    ]

    let onLogsFn: (logs: IntentProvenLog[]) => Promise<void> = async () => {}

    fakeClient.watchContractEvent.mockImplementation(({ onLogs }) => {
      onLogsFn = onLogs as (logs: IntentProvenLog[]) => Promise<void>
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

    expect($.mockOfQueue(QUEUES.SOURCE_INTENT.queue).add).toHaveBeenCalledWith(
      QUEUES.SOURCE_INTENT.jobs.proven_intent,
      { intentHash: '0xintent123' },
      expect.any(Object),
    )
  })

  it('skips logs when doValidation is true and isOurIntent returns false', async () => {
    const prover = {
      network: 'mainnet',
      chainID: 10,
      proverAddress: '0xabc',
    } as unknown as Prover

    const log: IntentProvenLog = {
      address: '0xabc',
      blockHash: '0xblock',
      blockNumber: 123n,
      logIndex: 0,
      transactionHash: '0xskipme',
      transactionIndex: 0,
      data: '0x',
      removed: false,
      topics: mockTopics(), // <-- required
      eventName: 'IntentProven',
      sourceNetwork: Network.ETH_MAINNET,
      sourceChainID: 1n,
      args: {
        _hash: '0xnotours',
        _claimant: '0x1',
      },
    }

    // 👇 Mock isOurIntent to return false
    jest.spyOn(service as any, 'isOurIntent').mockResolvedValueOnce(false)

    const addJob = service['addJob'](prover, { doValidation: true })
    await addJob([log])

    expect($.mockOfQueue(QUEUES.SOURCE_INTENT.queue).add).not.toHaveBeenCalled()
  })

  it('processes logs when doValidation is true and isOurIntent returns true', async () => {
    const prover = {
      network: 'mainnet',
      chainID: 10,
      proverAddress: '0xabc',
    } as unknown as Prover

    const log: IntentProvenLog = {
      address: '0xabc',
      blockHash: '0xblock',
      blockNumber: 456n,
      logIndex: 1,
      transactionHash: '0xprocessthis',
      transactionIndex: 0,
      data: '0x',
      removed: false,
      topics: mockTopics(), // <-- required
      eventName: 'IntentProven',
      sourceNetwork: Network.ETH_MAINNET,
      sourceChainID: 1n,
      args: {
        _hash: '0xours',
        _claimant: '0x1',
      },
    }

    // 👇 Mock isOurIntent to return true
    jest.spyOn(service as any, 'isOurIntent').mockResolvedValueOnce(true)

    const addJob = service['addJob'](prover, { doValidation: true })
    await addJob([log])

    expect($.mockOfQueue(QUEUES.SOURCE_INTENT.queue).add).toHaveBeenCalledWith(
      QUEUES.SOURCE_INTENT.jobs.proven_intent,
      { intentHash: '0xours' },
      expect.objectContaining({
        jobId: expect.any(String),
      }),
    )
  })

  it('processes only valid logs when doValidation is true', async () => {
    const prover = {
      network: 'mainnet',
      chainID: 10,
      proverAddress: '0xabc',
    } as unknown as Prover

    const logs: IntentProvenLog[] = [
      {
        address: '0xabc',
        blockHash: '0xblock1',
        blockNumber: 1n,
        logIndex: 0,
        transactionHash: '0xvalid1',
        transactionIndex: 0,
        data: '0x',
        removed: false,
        topics: mockTopics(), // <-- required
        eventName: 'IntentProven',
        sourceNetwork: Network.ETH_MAINNET,
        sourceChainID: 1n,
        args: {
          _hash: '0xvalidIntent1',
          _claimant: '0x1',
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
        topics: mockTopics(), // <-- required
        eventName: 'IntentProven',
        sourceNetwork: Network.ETH_MAINNET,
        sourceChainID: 1n,
        args: {
          _hash: '0xinvalidIntent',
          _claimant: '0x1',
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
        topics: mockTopics(), // <-- required
        eventName: 'IntentProven',
        sourceNetwork: Network.ETH_MAINNET,
        sourceChainID: 1n,
        args: {
          _hash: '0xvalidIntent2',
          _claimant: '0x1',
        },
      },
    ]

    // 👇 Simulate validation: only the 2 valid intent hashes should pass
    const isOurIntentMock = jest
      .spyOn(service as any, 'isOurIntent')
      .mockImplementation(async (log: IntentProvenLog) => {
        return log.args._hash !== '0xinvalidIntent'
      })

    const addJob = service['addJob'](prover, { doValidation: true })
    await addJob(logs)

    // 🧾 The queue should only be called for the valid logs
    const queue = $.mockOfQueue(QUEUES.SOURCE_INTENT.queue).add
    expect(queue).toHaveBeenCalledTimes(2)
    expect(queue).toHaveBeenCalledWith(
      QUEUES.SOURCE_INTENT.jobs.proven_intent,
      { intentHash: '0xvalidIntent1' },
      expect.any(Object),
    )
    expect(queue).toHaveBeenCalledWith(
      QUEUES.SOURCE_INTENT.jobs.proven_intent,
      { intentHash: '0xvalidIntent2' },
      expect.any(Object),
    )
  })
})
