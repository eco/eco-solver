import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { ChainSyncService } from '../chain-sync.service'
import { WatchCreateIntentService } from '../../watch/intent/watch-create-intent.service'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { IntentSourceModel } from '../../intent/schemas/intent-source.schema'
import { Model } from 'mongoose'
import { Solver, IntentSource } from '../../eco-configs/eco-config.types'
import { entries } from 'lodash'
import { KernelAccountClientService } from '../../transaction/smart-wallets/kernel/kernel-account-client.service'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'

describe('ChainSyncService', () => {
  let chainSyncService: ChainSyncService
  let accountService: DeepMocked<KernelAccountClientService>
  let watchIntentService: DeepMocked<WatchCreateIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        ChainSyncService,
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

    chainSyncService = chainMod.get(ChainSyncService)
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

    const IntentSource = {
      chainID: 123,
      sourceAddress: '0x123',
      network: 'network1',
    } as unknown as IntentSource

    const solvers = {
      123: {
        solverAddress: '0x456',
      },
      456: {
        solverAddress: '0x789',
      },
      789: {
        solverAddress: '0xabc',
      },
    } as any as Solver[]

    const solverSupportedChains = entries(solvers).map(([chainID]) => BigInt(chainID))

    const model = { event: { blockNumber: 50n, sourceChainID: IntentSource.chainID } }

    beforeEach(() => {
      mockGetContractEvents = jest.fn().mockResolvedValue([])

      accountService.getClient = jest.fn().mockReturnValue({
        getContractEvents: mockGetContractEvents,
      })

      ecoConfigService.getSolvers.mockReturnValue(solvers)
    })

    it('should set fromBlock to 0x0 when no transactions in db', async () => {
      await chainSyncService.syncTxsPerSource(IntentSource)
      expect(mockGetContractEvents).toHaveBeenCalledTimes(1)
      expect(mockGetContractEvents).toHaveBeenCalledWith({
        address: IntentSource.sourceAddress,
        abi: IntentSourceAbi,
        eventName: 'IntentCreated',
        args: {
          _destinationChain: solverSupportedChains,
        },
        fromBlock: 0n,
        toBlock: 'latest',
      })
    })

    it('should set fromBlock to the block of the db transaction', async () => {
      chainSyncService['getLastRecordedTx'] = jest.fn().mockResolvedValueOnce([model])

      await chainSyncService.syncTxsPerSource(IntentSource)
      expect(mockGetContractEvents).toHaveBeenCalledTimes(1)
      expect(mockGetContractEvents).toHaveBeenCalledWith({
        address: IntentSource.sourceAddress,
        abi: IntentSourceAbi,
        eventName: 'IntentCreated',
        args: {
          _destinationChain: solverSupportedChains,
        },
        fromBlock: model.event.blockNumber + 1n, // we search from the next block
        toBlock: 'latest',
      })
    })

    it('should log when no transfers exist since last db record', async () => {
      chainSyncService['getLastRecordedTx'] = jest.fn().mockResolvedValueOnce([model])
      const mockLog = jest.fn()
      chainSyncService['logger'].log = mockLog
      await chainSyncService.syncTxsPerSource(IntentSource)
      expect(mockGetContractEvents).toHaveBeenCalledTimes(1)
      expect(mockLog).toHaveBeenCalledTimes(1)
      // we search from the next block
      const searchFromBlock = model.event.blockNumber + 1n
      expect(mockLog).toHaveBeenCalledWith({
        msg: `No transactions found for source ${IntentSource.network} to sync from block ${searchFromBlock}`,
        chainID: model.event.sourceChainID,
        fromBlock: searchFromBlock,
      })
    })

    it('should process all the txs since the last saved blockNumber', async () => {
      chainSyncService['getLastRecordedTx'] = jest.fn().mockResolvedValueOnce([model])
      const logs = [{ msg: 'firstlog' }, { msg: 'secondlog' }, { msg: 'thirdlog' }]
      const returnLogs = logs.map((log) => {
        return {
          ...log,
          sourceNetwork: IntentSource.network,
          sourceChainID: IntentSource.chainID,
        }
      })
      const mockProcessJob = jest.fn()
      const mockAddJob = jest.fn(() => mockProcessJob)
      watchIntentService.addJob = mockAddJob as any
      mockGetContractEvents.mockResolvedValueOnce(logs)
      ecoConfigService.getIntentSources.mockReturnValue([IntentSource])

      await chainSyncService.syncTxs()
      expect(mockAddJob).toHaveBeenCalledTimes(1)
      expect(mockProcessJob).toHaveBeenCalledTimes(1)
      expect(mockAddJob).toHaveBeenCalledWith(IntentSource)
      expect(mockProcessJob).toHaveBeenCalledWith(returnLogs)
    })
  })
})
