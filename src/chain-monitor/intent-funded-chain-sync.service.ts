import { ChainSyncService } from '@/chain-monitor/chain-sync.service'
import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { IntentFundedEventModel } from '@/watch/intent/intent-funded-events/schemas/intent-funded-events.schema'
import { IntentFundedLog } from '@/contracts'
import { IntentSource } from '@/eco-configs/eco-config.types'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Model } from 'mongoose'
import { ModuleRef } from '@nestjs/core'
import { portalAbi } from '@/contracts/v2-abi/Portal'
import { WatchIntentFundedService } from '@/watch/intent/intent-funded-events/services/watch-intent-funded.service'

/**
 * Service class for syncing any missing transactions for all the source intent contracts.
 * When the module starts up, it will check for any transactions that have occurred since the
 * last recorded transaction in the database and what is on chain. Intended to fill any
 * gap in transactions that may have been missed while the service was down.
 */
@Injectable()
export class IntentFundedChainSyncService extends ChainSyncService {
  static MAX_BLOCK_RANGE = 10_000n
  private createIntentService: CreateIntentService

  constructor(
    @InjectModel(IntentSourceModel.name) protected intentModel: Model<IntentSourceModel>,
    readonly kernelAccountClientService: KernelAccountClientService,
    readonly watchIntentService: WatchIntentFundedService,
    ecoConfigService: EcoConfigService,
    private readonly moduleRef: ModuleRef,
  ) {
    super(
      intentModel,
      kernelAccountClientService,
      watchIntentService,
      ecoConfigService,
      new Logger(IntentFundedChainSyncService.name),
    )

    this.createIntentService = this.moduleRef.get(CreateIntentService, {
      strict: false,
    })
  }

  /**
   * Gets the missing transactions for a source intent contract by checking the last processed
   * event in the database and querying the chain for events from that block number.
   *
   * TODO: need to add pagination for large amounts of missing transactions with subgraphs at 10k events
   * @param source the source intent to get missing transactions for
   * @returns
   */
  async getMissingTxs(source: IntentSource): Promise<IntentFundedLog[]> {
    const client = await this.kernelAccountClientService.getClient(source.chainID)
    const lastRecordedTx = await this.getLastRecordedTx(source)

    let fromBlock = lastRecordedTx
      ? BigInt(lastRecordedTx.blockNumber) + 1n //start search from next block
      : undefined

    const toBlock = await client.getBlockNumber()

    if (fromBlock && toBlock - fromBlock > IntentFundedChainSyncService.MAX_BLOCK_RANGE) {
      fromBlock = toBlock - IntentFundedChainSyncService.MAX_BLOCK_RANGE
    }

    const allIntentFundedLogs = await client.getContractEvents({
      address: source.sourceAddress,
      abi: portalAbi,
      eventName: 'IntentFunded',
      strict: true,
      fromBlock,
      toBlock,
    })

    /* Make sure it's one of ours. It might not be ours because:
     * .The intent was created by another solver, so won't be in our database.
     * .The intent was not even a gasless one! Remember, publishAndFund() *also* emits IntentFunded events,
     *  and those ones are not gasless intents.
     */
    const resolvedLogs = await Promise.all(
      allIntentFundedLogs.map(async (log) => {
        const { error } = await this.createIntentService.getIntentForHash(log.args.intentHash)
        return { log, keep: !error }
      }),
    )

    const intentFundedLogs = resolvedLogs
      .filter((result) => result.keep)
      .map((result) => result.log)

    if (intentFundedLogs.length === 0) {
      this.logger.log(
        EcoLogMessage.fromDefault({
          message: `No transactions found for source ${source.network} to sync from block ${fromBlock}`,
          properties: {
            chainID: source.chainID,
            fromBlock,
          },
        }),
      )
      return []
    }

    // add the required source network and chain id to the logs
    return intentFundedLogs.map((log) => {
      return {
        ...log,
        sourceNetwork: source.network,
        sourceChainID: source.chainID,
      } as unknown as IntentFundedLog
    })
  }

  /**
   * Returns the last recorded transaction for a source intent contract.
   *
   * @param source the source intent to get the last recorded transaction for
   * @returns
   */
  async getLastRecordedTx(source: IntentSource): Promise<IntentFundedEventModel | undefined> {
    return this.watchIntentService.getLastRecordedTx(BigInt(source.chainID))
  }
}
