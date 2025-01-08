import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { IntentSourceModel } from '../intent/schemas/intent-source.schema'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { IntentSource } from '../eco-configs/eco-config.types'
import { IntentCreatedLog } from '../contracts'
import { entries } from 'lodash'
import { BlockTag } from 'viem'
import { WatchCreateIntentService } from '../watch/intent/watch-create-intent.service'
import { KernelAccountClientService } from '../transaction/smart-wallets/kernel/kernel-account-client.service'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'

/**
 * Service class for syncing any missing transactions for all the source intent contracts.
 * When the module starts up, it will check for any transactions that have occured since the
 * last recorded transaction in the database and what is on chain. Intended to fill any
 * gap in transactions that may have been missed while the serivce was down.
 */
@Injectable()
export class ChainSyncService implements OnApplicationBootstrap {
  private logger = new Logger(ChainSyncService.name)

  constructor(
    @InjectModel(IntentSourceModel.name) private intentModel: Model<IntentSourceModel>,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly watchIntentService: WatchCreateIntentService,
    private ecoConfigService: EcoConfigService,
  ) {}

  async onApplicationBootstrap() {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `ChainSyncService:OnApplicationBootstrap`,
      }),
    )
    await this.syncTxs()
  }

  /**
   * Syncs all the missing transactions for all the source intent contracts.
   */
  async syncTxs() {
    const missingTxsTasks = this.ecoConfigService.getIntentSources().map((source) => {
      return this.syncTxsPerSource(source)
    })

    await Promise.all(missingTxsTasks)
  }

  /**
   * Returns the missing transactions for a source intent contract
   *
   * @param source the source intent to get the missing transactions for
   * @returns
   */
  async syncTxsPerSource(source: IntentSource) {
    const createIntentLogs = await this.getMissingTxs(source)
    if (createIntentLogs.length === 0) {
      return
    }

    return this.watchIntentService.addJob(source)(createIntentLogs)
  }

  /**
   * Gets the missing transactions for a source intent contract by checking the last processed
   * event in the database and querying the chain for events from that block number.
   *
   * TODO: need to add pagination for large amounts of missing transactions with subgraphs at 10k events
   * @param source the source intent to get missing transactions for
   * @returns
   */
  async getMissingTxs(source: IntentSource): Promise<IntentCreatedLog[]> {
    const client = await this.kernelAccountClientService.getClient(source.chainID)
    const solverSupportedChains = entries(this.ecoConfigService.getSolvers()).map(([chainID]) =>
      BigInt(chainID),
    )
    const lastRecordedTx = await this.getLastRecordedTx(source)
    const fromBlock: bigint =
      lastRecordedTx.length > 0
        ? BigInt(lastRecordedTx[0].event.blockNumber) + 1n //start search from next block
        : 0n
    const toBlock: BlockTag = 'latest'

    const createIntentLogs = await client.getContractEvents({
      address: source.sourceAddress,
      abi: IntentSourceAbi,
      eventName: 'IntentCreated',
      args: {
        // restrict by acceptable chains, chain ids must be bigints
        _destinationChain: solverSupportedChains,
      },
      fromBlock,
      toBlock,
    })

    //todo clean out already fulfilled intents
    if (createIntentLogs.length === 0) {
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
    return createIntentLogs.map((log) => {
      return {
        ...log,
        sourceNetwork: source.network,
        sourceChainID: source.chainID,
      } as unknown as IntentCreatedLog
    })
  }

  /**
   * Returns the last recorded transaction for a source intent contract.
   *
   * @param source the source intent to get the last recorded transaction for
   * @returns
   */
  async getLastRecordedTx(source: IntentSource): Promise<IntentSourceModel[]> {
    return await this.intentModel
      .find({ 'event.sourceChainID': source.chainID })
      .sort({ 'event.blockNumber': -1 })
      .limit(1)
      .exec()
  }
}
