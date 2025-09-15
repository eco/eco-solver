import { EcoConfigService } from '../eco-configs/eco-config.service'
import { IntentSource } from '../eco-configs/eco-config.types'
import { IntentSourceModel } from '../intent/schemas/intent-source.schema'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { Log } from 'viem'
import { Logger, OnApplicationBootstrap } from '@nestjs/common'
import { Model } from 'mongoose'
import { WatchEventService } from '@/watch/intent/watch-event.service'
import { LogOperation } from '@/common/logging/decorators'
import { ChainSyncLogger } from '@/common/logging/loggers'

/**
 * Service class for syncing any missing transactions for all the source intent contracts.
 * When the module starts up, it will check for any transactions that have occured since the
 * last recorded transaction in the database and what is on chain. Intended to fill any
 * gap in transactions that may have been missed while the serivce was down.
 */
export abstract class ChainSyncService implements OnApplicationBootstrap {
  protected chainSyncLogger: ChainSyncLogger

  constructor(
    protected intentModel: Model<IntentSourceModel>,
    protected kernelAccountClientService: KernelAccountClientService,
    protected watchIntentService: WatchEventService<IntentSource>,
    protected ecoConfigService: EcoConfigService,
    protected logger: Logger,
  ) {
    this.chainSyncLogger = new ChainSyncLogger()
  }

  @LogOperation('chain-sync', ChainSyncLogger)
  async onApplicationBootstrap() {
    const startTime = Date.now()

    try {
      this.chainSyncLogger.logBootstrapSync('all-sources', 0, 'started')
      await this.syncTxs()

      const processingTime = Date.now() - startTime
      this.chainSyncLogger.logBootstrapSync('all-sources', 0, 'completed', processingTime)
    } catch (error) {
      this.chainSyncLogger.logSyncError(error as Error, 'all-sources', 0, 'application_bootstrap')
      throw error
    }
  }

  /**
   * Syncs all the missing transactions for all the source intent contracts.
   */
  @LogOperation('chain-sync', ChainSyncLogger)
  async syncTxs() {
    const startTime = Date.now()
    const intentSources = this.ecoConfigService.getIntentSources()
    let totalEventCount = 0

    try {
      const missingTxsTasks = intentSources.map(async (source) => {
        const eventCount = await this.syncTxsPerSource(source)
        totalEventCount += eventCount || 0
        return eventCount
      })

      await Promise.all(missingTxsTasks)

      const processingTime = Date.now() - startTime
      this.chainSyncLogger.logTransactionSync(
        'all-sources',
        0,
        'completed',
        totalEventCount,
        processingTime,
      )
    } catch (error) {
      this.chainSyncLogger.logSyncError(error as Error, 'all-sources', 0, 'sync_transactions')
      throw error
    }
  }

  /**
   * Returns the missing transactions for a source intent contract
   *
   * @param source the source intent to get the missing transactions for
   * @returns
   */
  @LogOperation('chain-sync', ChainSyncLogger)
  async syncTxsPerSource(source: IntentSource): Promise<number> {
    try {
      const createIntentLogs = await this.getMissingTxs(source)
      if (createIntentLogs.length === 0) {
        return 0
      }

      await this.watchIntentService.addJob(source)(createIntentLogs)
      return createIntentLogs.length
    } catch (error) {
      this.chainSyncLogger.logSyncError(
        error as Error,
        source.network,
        source.chainID,
        'sync_transactions',
      )
      throw error
    }
  }

  /**
   * Gets the missing transactions for a source intent contract by checking the last processed
   * event in the database and querying the chain for events from that block number.
   *
   * TODO: need to add pagination for large amounts of missing transactions with subgraphs at 10k events
   * @param source the source intent to get missing transactions for
   * @returns
   */
  abstract getMissingTxs(source: IntentSource): Promise<Log[]>
}
