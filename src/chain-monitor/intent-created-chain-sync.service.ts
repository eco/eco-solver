import { ChainSyncService } from '@/chain-monitor/chain-sync.service'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentCreatedLog } from '../contracts'
import { IntentSource } from '../eco-configs/eco-config.types'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { IntentSourceModel } from '../intent/schemas/intent-source.schema'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { Model } from 'mongoose'
import { WatchCreateIntentService } from '../watch/intent/watch-create-intent.service'
import { LogOperation } from '@/common/logging/decorators'
import { ChainSyncLogger } from '@/common/logging/loggers'

/**
 * Service class for syncing any missing transactions for all the source intent contracts.
 * When the module starts up, it will check for any transactions that have occurred since the
 * last recorded transaction in the database and what is on chain. Intended to fill any
 * gap in transactions that may have been missed while the service was down.
 */
@Injectable()
export class IntentCreatedChainSyncService extends ChainSyncService {
  static MAX_BLOCK_RANGE = 10_000n

  constructor(
    @InjectModel(IntentSourceModel.name) protected intentModel: Model<IntentSourceModel>,
    readonly kernelAccountClientService: KernelAccountClientService,
    readonly watchIntentService: WatchCreateIntentService,
    ecoConfigService: EcoConfigService,
  ) {
    super(
      intentModel,
      kernelAccountClientService,
      watchIntentService,
      ecoConfigService,
      new Logger(IntentCreatedChainSyncService.name),
    )
  }

  @LogOperation('chain-sync', ChainSyncLogger)
  async onApplicationBootstrap() {
    await super.onApplicationBootstrap()
  }

  /**
   * Gets the missing transactions for a source intent contract by checking the last processed
   * event in the database and querying the chain for events from that block number.
   *
   * TODO: need to add pagination for large amounts of missing transactions with subgraphs at 10k events
   * @param source the source intent to get missing transactions for
   * @returns
   */
  @LogOperation('chain-sync', ChainSyncLogger)
  async getMissingTxs(source: IntentSource): Promise<IntentCreatedLog[]> {
    const startTime = Date.now()

    try {
      const client = await this.kernelAccountClientService.getClient(source.chainID)

      const supportedChains = this.ecoConfigService.getSupportedChains()
      const [lastRecordedTx] = await this.getLastRecordedTx(source)

      // Log the last recorded transaction info
      this.chainSyncLogger.logLastRecordedTransaction(
        source.network,
        source.chainID,
        lastRecordedTx?.event?.blockNumber ? Number(lastRecordedTx.event.blockNumber) : undefined,
        lastRecordedTx?.event?.transactionHash,
        undefined, // intentHash not available in IntentSourceModel
      )

      let fromBlock = lastRecordedTx
        ? BigInt(lastRecordedTx.event!.blockNumber) + 1n //start search from next block
        : undefined

      const toBlock = await client.getBlockNumber()

      if (fromBlock && toBlock - fromBlock > IntentCreatedChainSyncService.MAX_BLOCK_RANGE) {
        fromBlock = toBlock - IntentCreatedChainSyncService.MAX_BLOCK_RANGE
      }

      const allCreateIntentLogs = await client.getContractEvents({
        address: source.sourceAddress,
        abi: IntentSourceAbi,
        eventName: 'IntentCreated',
        strict: true,
        args: {
          prover: source.provers,
        },
        fromBlock,
        toBlock,
      })

      const createIntentLogs = allCreateIntentLogs.filter((log) =>
        supportedChains.includes(log.args.destination),
      )

      const processingTime = Date.now() - startTime
      const blockRange = fromBlock ? toBlock - fromBlock : toBlock

      // Log missing transactions found
      this.chainSyncLogger.logMissingTransactions(
        source.network,
        source.chainID,
        fromBlock,
        toBlock,
        createIntentLogs.length,
        'intent_created',
        IntentCreatedChainSyncService.MAX_BLOCK_RANGE,
      )

      // Log performance metrics if we found transactions
      if (createIntentLogs.length > 0) {
        this.chainSyncLogger.logSyncPerformance(
          source.network,
          source.chainID,
          'intent_created',
          createIntentLogs.length,
          processingTime,
          blockRange,
        )

        // Log individual transaction processing (only for small batches to control log volume)
        if (createIntentLogs.length <= 10) {
          createIntentLogs.forEach((log) => {
            this.chainSyncLogger.logTransactionProcessed(
              log.args.hash,
              log.transactionHash,
              log.blockNumber,
              source.network,
              source.chainID,
              'intent_created',
            )
          })
        } else {
          // For large batches, log a summary with sample transactions
          const sampleLogs = createIntentLogs.slice(0, 3)
          sampleLogs.forEach((log) => {
            this.chainSyncLogger.logTransactionProcessed(
              log.args.hash,
              log.transactionHash,
              log.blockNumber,
              source.network,
              source.chainID,
              'intent_created',
            )
          })
        }
      }

      // add the required source network and chain id to the logs
      return createIntentLogs.map((log) => {
        return {
          ...log,
          sourceNetwork: source.network,
          sourceChainID: source.chainID,
        } as unknown as IntentCreatedLog
      })
    } catch (error) {
      this.chainSyncLogger.logSyncError(
        error as Error,
        source.network,
        source.chainID,
        'intent_created',
      )
      throw error
    }
  }

  /**
   * Returns the last recorded transaction for a source intent contract.
   *
   * @param source the source intent to get the last recorded transaction for
   * @returns
   */
  @LogOperation('chain-sync', ChainSyncLogger)
  async getLastRecordedTx(source: IntentSource): Promise<IntentSourceModel[]> {
    return await this.intentModel
      .find({ 'event.sourceChainID': source.chainID })
      .sort({ 'event.blockNumber': -1 })
      .limit(1)
      .exec()
  }
}
