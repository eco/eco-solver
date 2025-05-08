import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { getModelToken } from '@nestjs/mongoose'
import { IntentCreatedChainSyncService } from '@/chain-monitor/intent-created-chain-sync.service'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { IntentSourceModel } from '../../intent/schemas/intent-source.schema'
import { KernelAccountClientService } from '../../transaction/smart-wallets/kernel/kernel-account-client.service'
import { Model } from 'mongoose'
import { Solver, IntentSource } from '../../eco-configs/eco-config.types'
import { Test, TestingModule } from '@nestjs/testing'
import { WatchCreateIntentService } from '../../watch/intent/watch-create-intent.service'

describe('IntentCreatedChainSyncService', () => {
  let chainSyncService: IntentCreatedChainSyncService
  let accountService: DeepMocked<KernelAccountClientService>
  let watchIntentService: DeepMocked<WatchCreateIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        IntentCreatedChainSyncService,
        {
          provide: KernelAccountClientService,
          useValue: createMock<KernelAccountClientService>(),
        },
        { provide: WatchCreateIntentService, useValue: createMock<WatchCreateIntentService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: getModelToken(IntentSourceModel.name),
          useValue: createMock<Model<IntentSourceModel>>(),
        },
      ],
    }).compile()

    chainSyncService = chainMod.get(IntentCreatedChainSyncService)
    accountService = chainMod.get(KernelAccountClientService)
    watchIntentService = chainMod.get(WatchCreateIntentService)
    ecoConfigService = chainMod.get(EcoConfigService) as DeepMocked<EcoConfigService>
  })

  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
  })

  describe('on chain sync startup', () => {
    it('should start a sync', async () => {
      const mockSyncTxs = jest.fn()
      chainSyncService.syncTxs = mockSyncTxs
      await chainSyncService.onApplicationBootstrap()
      expect(mockSyncTxs).toHaveBeenCalledTimes(1)
    })
  })

  describe('on syncTxs', () => {
    it('should start a sync for all source intent contracts', async () => {
      const intentSources = [
        { network: 'network1' },
        { network: 'network2' },
        { network: 'network3' },
      ] as any
      const mockSyncTxsPerSource = jest.fn()
      chainSyncService.syncTxsPerSource = mockSyncTxsPerSource
      ecoConfigService.getIntentSources.mockReturnValue(intentSources)

      chainSyncService.syncTxs()
      expect(mockSyncTxsPerSource).toHaveBeenCalledTimes(3)
      expect(mockSyncTxsPerSource).toHaveBeenNthCalledWith(1, intentSources[0])
      expect(mockSyncTxsPerSource).toHaveBeenNthCalledWith(2, intentSources[1])
      expect(mockSyncTxsPerSource).toHaveBeenNthCalledWith(3, intentSources[2])
    })
  })

  describe('on syncTxsPerSource', () => {
    let mockGetContractEvents: jest.Mock

    const intentSource = {
      chainID: 123,
      sourceAddress: '0x123',
      network: 'network1',
      provers: ['0x456', '0x789', '0xabc'],
    } as unknown as IntentSource

    const solvers = {
      123: {
        inboxAddress: '0x456',
      },
      456: {
        inboxAddress: '0x789',
      },
      789: {
        inboxAddress: '0xabc',
      },
    } as any as Solver[]

    const toBlock = 100n

    const model = {
      intent: {
        route: { source: intentSource.chainID },
      },
      event: { blockNumber: 50n, sourceChainID: intentSource.chainID },
    } as unknown as IntentSourceModel

    const supportedChains = Object.keys(solvers).map((key) => BigInt(key))
    beforeEach(() => {
      mockGetContractEvents = jest.fn().mockResolvedValue([])

      accountService.getClient = jest.fn().mockReturnValue({
        getContractEvents: mockGetContractEvents,
        getBlockNumber: jest.fn().mockReturnValue(toBlock),
      })

      ecoConfigService.getSolvers.mockReturnValue(solvers)
    })

    it('should set fromBlock to undefined when no transactions in db', async () => {
      await chainSyncService.syncTxsPerSource(intentSource)
      expect(mockGetContractEvents).toHaveBeenCalledTimes(1)
      expect(mockGetContractEvents).toHaveBeenCalledWith({
        address: intentSource.sourceAddress,
        abi: IntentSourceAbi,
        eventName: 'IntentCreated',
        args: {
          prover: intentSource.provers,
        },
        strict: true,
        fromBlock: undefined,
        toBlock,
      })
    })

    it('should set fromBlock to the block of the db transaction', async () => {
      chainSyncService['getLastRecordedTx'] = jest.fn().mockResolvedValueOnce([model])

      await chainSyncService.syncTxsPerSource(intentSource)
      expect(mockGetContractEvents).toHaveBeenCalledTimes(1)
      expect(mockGetContractEvents).toHaveBeenCalledWith({
        address: intentSource.sourceAddress,
        abi: IntentSourceAbi,
        eventName: 'IntentCreated',
        args: {
          prover: intentSource.provers,
        },
        fromBlock: model.event!.blockNumber + 1n, // we search from the next block
        toBlock,
        strict: true,
      })
    })

    it('should log when no transfers exist since last db record', async () => {
      chainSyncService['getLastRecordedTx'] = jest.fn().mockResolvedValueOnce([model])
      const mockLog = jest.fn()
      chainSyncService['logger'].log = mockLog
      await chainSyncService.syncTxsPerSource(intentSource)
      expect(mockGetContractEvents).toHaveBeenCalledTimes(1)
      expect(mockLog).toHaveBeenCalledTimes(1)
      // we search from the next block
      const searchFromBlock = model.event!.blockNumber + 1n
      expect(mockLog).toHaveBeenCalledWith({
        msg: `No transactions found for source ${intentSource.network} to sync from block ${searchFromBlock}`,
        chainID: IntentSourceModel.getSource(model),
        fromBlock: searchFromBlock,
      })
    })

    it('should process all the txs that are to a supported destination since the last saved blockNumber', async () => {
      const unsupportedChain = 1000n
      chainSyncService['getLastRecordedTx'] = jest.fn().mockResolvedValueOnce([model])
      ecoConfigService.getSupportedChains.mockReturnValue(supportedChains)
      const logs = [
        { msg: 'firstlog', args: { destination: supportedChains[0] } },
        { msg: 'secondlog', args: { destination: supportedChains[1] } },
        { msg: 'thirdlog', args: { destination: unsupportedChain } },
      ]
      const returnLogs = logs
        .filter((log) => supportedChains.includes(log.args.destination))
        .map((log) => {
          return {
            ...log,
            sourceNetwork: intentSource.network,
            sourceChainID: intentSource.chainID,
          }
        })
      const mockProcessJob = jest.fn()
      const mockAddJob = jest.fn(() => mockProcessJob)
      watchIntentService.addJob = mockAddJob as any
      mockGetContractEvents.mockResolvedValueOnce(logs)
      ecoConfigService.getIntentSources.mockReturnValue([intentSource])

      await chainSyncService.syncTxs()
      expect(mockAddJob).toHaveBeenCalledTimes(1)
      expect(mockProcessJob).toHaveBeenCalledTimes(1)
      expect(mockAddJob).toHaveBeenCalledWith(intentSource)
      expect(mockProcessJob).toHaveBeenCalledWith(returnLogs)
      expect(returnLogs).toHaveLength(2)
    })
  })
})
