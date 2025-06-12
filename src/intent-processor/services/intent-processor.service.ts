import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import * as _ from 'lodash'
import {
  Chain,
  encodeAbiParameters,
  encodeFunctionData,
  Hex,
  pad,
  PublicClient,
  TransactionRequest,
  Transport,
} from 'viem'
import { InboxAbi, IntentSourceAbi } from '@eco-foundation/routes-ts'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { HyperlaneConfig, SendBatchConfig, WithdrawsConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { IndexerService } from '@/indexer/services/indexer.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import * as Hyperlane from '@/intent-processor/utils/hyperlane'
import { getWithdrawData } from '@/intent-processor/utils/intent'
import { ExecuteWithdrawsJobData } from '@/intent-processor/jobs/execute-withdraws.job'
import {
  IntentProcessorQueue,
  IntentProcessorQueueType,
} from '@/intent-processor/queues/intent-processor.queue'
import { ExecuteSendBatchJobData } from '@/intent-processor/jobs/execute-send-batch.job'
import { batchTransactionsWithMulticall } from '@/common/multicall/multicall3'
import { getChainConfig } from '@/eco-configs/utils'

@Injectable()
export class IntentProcessorService implements OnApplicationBootstrap {
  private logger = new Logger(IntentProcessorService.name)

  private config: {
    sendBatch: SendBatchConfig
    hyperlane: HyperlaneConfig
    withdrawals: WithdrawsConfig
  }
  private readonly intentProcessorQueue: IntentProcessorQueue

  constructor(
    @InjectQueue(IntentProcessorQueue.queueName)
    queue: IntentProcessorQueueType,
    private readonly ecoConfigService: EcoConfigService,
    private readonly indexerService: IndexerService,
    private readonly walletClientDefaultSignerService: WalletClientDefaultSignerService,
  ) {
    this.intentProcessorQueue = new IntentProcessorQueue(queue)
  }

  async onApplicationBootstrap() {
    this.config = {
      sendBatch: this.ecoConfigService.getSendBatch(),
      hyperlane: this.ecoConfigService.getHyperlane(),
      withdrawals: this.ecoConfigService.getWithdraws(),
    }
    await this.intentProcessorQueue.startWithdrawalsCronJobs(
      this.config.withdrawals.intervalDuration,
    )
    await this.intentProcessorQueue.startSendBatchCronJobs(this.config.sendBatch.intervalDuration)
  }

  async getNextBatchWithdrawals() {
    const intentSourceAddr = this.getIntentSource()

    const batchWithdrawals = await this.indexerService.getNextBatchWithdrawals(intentSourceAddr)
    const batchWithdrawalsPerSource = _.groupBy(
      batchWithdrawals,
      (withdrawal) => withdrawal.intent.source,
    )

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getNextBatchWithdrawals(): Withdrawals`,
        properties: {
          intentSourceAddr,
          intentHashes: _.map(batchWithdrawals, (withdrawal) => withdrawal.intent.hash),
        },
      }),
    )

    const jobsData: ExecuteWithdrawsJobData[] = []

    for (const sourceChainId in batchWithdrawalsPerSource) {
      const batchWithdrawalsData = batchWithdrawalsPerSource[sourceChainId].map(({ intent }) =>
        getWithdrawData(intent),
      )

      const chunkWithdrawals = _.chunk(batchWithdrawalsData, this.config.withdrawals.chunkSize)

      // Set a maximum number of withdrawals per transaction
      chunkWithdrawals.forEach((chunk) => {
        jobsData.push({ chainId: parseInt(sourceChainId), intentSourceAddr, intents: chunk })
      })
    }

    this.intentProcessorQueue.addExecuteWithdrawalsJobs(jobsData)
  }

  async getNextSendBatch() {
    const intentSourceAddr = this.getIntentSource()

    const proves = await this.indexerService.getNextSendBatch(intentSourceAddr)
    const batchProvesPerChain = _.groupBy(proves, (prove) => prove.destinationChainId)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getNextSendBatch(): Send batches`,
        properties: {
          intentSourceAddr,
          intentHashes: _.map(proves, (prove) => prove.hash),
        },
      }),
    )

    const jobsData: ExecuteSendBatchJobData[] = []

    for (const chainId in batchProvesPerChain) {
      const sendBatchData = batchProvesPerChain[chainId].map((prove) => ({
        hash: prove.hash,
        prover: prove.prover,
        source: prove.chainId,
      }))

      // A Batch must contain the same prover and destination
      // Batch is sorted to contain as many send batches as possible per chunk
      const sortedBatch = _.sortBy(sendBatchData, (data) => [data.prover, data.source].join('-'))

      const chunkExecutions = _.chunk(sortedBatch, this.config.sendBatch.chunkSize)

      // Set a maximum number of withdrawals per transaction
      chunkExecutions.forEach((chunkExecution) => {
        jobsData.push({ chainId: parseInt(chainId), proves: chunkExecution })
      })
    }

    await this.intentProcessorQueue.addExecuteSendBatchJobs(jobsData)
  }

  async executeWithdrawals(data: ExecuteWithdrawsJobData) {
    const { intents, intentSourceAddr, chainId } = data

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.executeWithdrawals(): Withdrawals`,
        properties: {
          chainId: data.chainId,
          intentSourceAddr: data.intentSourceAddr,
          routeHash: data.intents,
        },
      }),
    )

    const walletClient = await this.walletClientDefaultSignerService.getClient(chainId)
    const publicClient = await this.walletClientDefaultSignerService.getPublicClient(chainId)

    const txHash = await walletClient.writeContract({
      abi: IntentSourceAbi,
      address: intentSourceAddr,
      args: [intents],
      functionName: 'batchWithdraw',
    })

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.executeWithdrawals(): Transaction sent`,
        properties: {
          chainId: data.chainId,
          transactionHash: txHash,
        },
      }),
    )

    await publicClient.waitForTransactionReceipt({ hash: txHash })
  }

  async executeSendBatch(data: ExecuteSendBatchJobData) {
    const { proves, chainId } = data

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.executeSendBatch(): Send batch`,
        properties: { chainId, routeHash: _.map(proves, 'hash') },
      }),
    )

    const inboxAddr = this.getInbox()
    const walletClient = await this.walletClientDefaultSignerService.getClient(chainId)
    const publicClient = await this.walletClientDefaultSignerService.getPublicClient(chainId)

    const batches = _.groupBy(proves, (prove) => [prove.prover, prove.source].join('-'))
    const sendBatchTransactions = await Promise.all(
      Object.values(batches).map((batch) => {
        const { prover, source } = batch[0]
        const hashes = _.map(batch, 'hash')
        return this.getSendBatchTransaction(publicClient, inboxAddr, prover, source, hashes)
      }),
    )

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.executeSendBatch(): Send batch transactions`,
        properties: { sendBatchTransactions, groups: Object.keys(batches) },
      }),
    )

    const transaction = batchTransactionsWithMulticall(chainId, sendBatchTransactions)

    const txHash = await walletClient.sendTransaction(transaction)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.executeSendBatch(): Transaction sent`,
        properties: {
          chainId: data.chainId,
          transactionHash: txHash,
        },
      }),
    )

    await publicClient.waitForTransactionReceipt({ hash: txHash })
  }

  private getIntentSource() {
    const intentSources = this.ecoConfigService.getIntentSources()
    const uniqIntentSources = _.uniq(_.map(intentSources, 'sourceAddress'))

    if (uniqIntentSources.length > 1) {
      throw new Error(
        'Implementation has to be refactor to support multiple intent source addresses.',
      )
    }

    return uniqIntentSources[0]
  }

  private getInbox() {
    const intentSources = this.ecoConfigService.getIntentSources()
    const uniqInbox = _.uniq(_.map(intentSources, 'inbox'))

    if (uniqInbox.length > 1) {
      throw new Error('Implementation has to be refactor to support multiple inbox addresses.')
    }

    return uniqInbox[0]
  }

  /**
   * Get sendBatch transaction data
   * @param publicClient
   * @param inbox
   * @param prover
   * @param source
   * @param intentHashes
   * @private
   */
  private async getSendBatchTransaction(
    publicClient: PublicClient<Transport, Chain>,
    inbox: Hex,
    prover: Hex,
    source: number,
    intentHashes: Hex[],
  ): Promise<TransactionRequest> {
    const { claimant } = this.ecoConfigService.getEth()
    const message = Hyperlane.getMessageData(claimant, intentHashes)

    const messageGasLimit = await this.estimateMessageGas(
      inbox,
      prover,
      publicClient.chain.id,
      source,
      message,
      intentHashes.length,
    )

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getSendBatchTransaction(): Message gas limit`,
        properties: {
          numIntents: intentHashes.length,
          messageDestination: source,
          messageGasLimit: messageGasLimit.toString(),
        },
      }),
    )

    const metadata = Hyperlane.getMetadata(0n, messageGasLimit)

    const { mailbox, ...hooks } = Hyperlane.getChainMetadata(
      this.config.hyperlane,
      publicClient.chain.id,
    )

    const aggregationHook = this.config.hyperlane.useHyperlaneDefaultHook
      ? (hooks.hyperlaneAggregationHook as Hex)
      : (hooks.aggregationHook as Hex)

    const fee = await Hyperlane.estimateFee(
      publicClient,
      mailbox as Hex,
      source,
      prover,
      message,
      metadata,
      aggregationHook,
    )

    const { HyperProver: hyperProverAddr } = getChainConfig(Number(publicClient.chain.id))

    const messageData = encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
      [pad(prover), metadata, aggregationHook],
    )

    const data = encodeFunctionData({
      abi: InboxAbi,
      functionName: 'initiateProving',
      args: [BigInt(source), intentHashes, hyperProverAddr, messageData],
    })

    return {
      to: inbox,
      value: fee,
      data,
    }
  }

  private async estimateMessageGas(
    inbox: Hex,
    prover: Hex,
    origin: number,
    source: number,
    messageData: Hex,
    intentCount: number,
  ): Promise<bigint> {
    try {
      const { mailbox } = Hyperlane.getChainMetadata(this.config.hyperlane, source)

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `${IntentProcessorService.name}.estimateMessageGas(): Simulate`,
          properties: {
            chainId: source,
            origin,
            handler: prover,
            sender: inbox,
            messageData,
          },
        }),
      )

      const publicClient = await this.walletClientDefaultSignerService.getPublicClient(source)
      return await Hyperlane.estimateMessageGas(
        publicClient,
        mailbox as Hex,
        prover,
        origin,
        inbox,
        messageData,
      )
    } catch (error) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `${IntentProcessorService.name}.estimateMessageGas(): Failed to estimate message gas.`,
          properties: { error: error.message },
        }),
      )

      // Estimate 25k gas per intent
      return BigInt(this.config.sendBatch.defaultGasPerIntent) * BigInt(intentCount)
    }
  }
}
