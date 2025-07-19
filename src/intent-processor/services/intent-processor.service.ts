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
import {
  HyperlaneConfig,
  SendBatchConfig,
  WithdrawsConfig,
  IntentSource,
} from '@/eco-configs/eco-config.types'
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
import { Multicall3Abi } from '@/contracts/Multicall3'
import { getMulticall } from '@/intent-processor/utils/multicall'
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
    const intentSources = this.ecoConfigService.getIntentSources()

    if (intentSources.length === 0) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `${IntentProcessorService.name}.getNextBatchWithdrawals(): No intent sources configured`,
        }),
      )
      return
    }

    const jobsData: ExecuteWithdrawsJobData[] = []

    // Process each intent source independently
    for (const intentSource of intentSources) {
      const { sourceAddress: intentSourceAddr, inbox, chainID } = intentSource

      const batchWithdrawals = await this.indexerService.getNextBatchWithdrawals(intentSourceAddr)

      if (batchWithdrawals.length === 0) {
        continue
      }

      const batchWithdrawalsPerSource = _.groupBy(
        batchWithdrawals,
        (withdrawal) => withdrawal.intent.source,
      )

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `${IntentProcessorService.name}.getNextBatchWithdrawals(): Withdrawals for intent source`,
          properties: {
            intentSourceAddr,
            inbox,
            chainID,
            intentHashes: _.map(batchWithdrawals, (withdrawal) => withdrawal.intent.hash),
          },
        }),
      )

      for (const sourceChainId in batchWithdrawalsPerSource) {
        const batchWithdrawalsData = batchWithdrawalsPerSource[sourceChainId].map(({ intent }) =>
          getWithdrawData(intent),
        )

        const chunkWithdrawals = _.chunk(batchWithdrawalsData, this.config.withdrawals.chunkSize)

        // Set a maximum number of withdrawals per transaction
        chunkWithdrawals.forEach((chunk) => {
          jobsData.push({
            chainId: parseInt(sourceChainId),
            intentSourceAddr,
            inbox,
            intents: chunk,
          })
        })
      }
    }

    if (jobsData.length > 0) {
      this.intentProcessorQueue.addExecuteWithdrawalsJobs(jobsData)
    }
  }

  async getNextSendBatch() {
    const intentSources = this.ecoConfigService.getIntentSources()

    if (intentSources.length === 0) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `${IntentProcessorService.name}.getNextSendBatch(): No intent sources configured`,
        }),
      )
      return
    }

    const jobsData: ExecuteSendBatchJobData[] = []

    // Process each intent source independently
    for (const intentSource of intentSources) {
      const { sourceAddress: intentSourceAddr, inbox, chainID } = intentSource

      const proves = await this.indexerService.getNextSendBatch(intentSourceAddr)

      if (proves.length === 0) {
        continue
      }

      const batchProvesPerChain = _.groupBy(proves, (prove) => prove.destinationChainId)

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `${IntentProcessorService.name}.getNextSendBatch(): Send batches for intent source`,
          properties: {
            intentSourceAddr,
            inbox,
            chainID,
            intentHashes: _.map(proves, (prove) => prove.hash),
          },
        }),
      )

      for (const chainId in batchProvesPerChain) {
        const sendBatchData = batchProvesPerChain[chainId].map((prove) => ({
          hash: prove.hash,
          prover: prove.prover,
          source: prove.chainId,
          intentSourceAddr,
          inbox,
        }))

        // A Batch must contain the same prover, destination, and intent source
        // Batch is sorted to contain as many send batches as possible per chunk
        const sortedBatch = _.sortBy(sendBatchData, (data) =>
          [data.prover, data.source, data.intentSourceAddr].join('-'),
        )

        const chunkExecutions = _.chunk(sortedBatch, this.config.sendBatch.chunkSize)

        // Set a maximum number of send batches per transaction
        chunkExecutions.forEach((chunkExecution) => {
          jobsData.push({
            chainId: parseInt(chainId),
            intentSourceAddr,
            inbox,
            proves: chunkExecution,
          })
        })
      }
    }

    if (jobsData.length > 0) {
      await this.intentProcessorQueue.addExecuteSendBatchJobs(jobsData)
    }
  }

  async executeWithdrawals(data: ExecuteWithdrawsJobData) {
    const { intents, intentSourceAddr, inbox, chainId } = data

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.executeWithdrawals(): Withdrawals`,
        properties: {
          chainId: data.chainId,
          intentSourceAddr: data.intentSourceAddr,
          inbox: inbox,
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
    const { proves, chainId, inbox: inboxAddr, intentSourceAddr } = data

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.executeSendBatch(): Send batch`,
        properties: {
          chainId,
          inboxAddr,
          intentSourceAddr,
          routeHash: _.map(proves, 'hash'),
        },
      }),
    )

    const walletClient = await this.walletClientDefaultSignerService.getClient(chainId)
    const publicClient = await this.walletClientDefaultSignerService.getPublicClient(chainId)

    const batches = _.groupBy(proves, (prove) =>
      [prove.prover, prove.source, prove.intentSourceAddr].join('-'),
    )
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

    const transaction = this.sendTransactions(chainId, sendBatchTransactions)

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

  /**
   * Aggregates transactions using a Multicall contract
   * @param chainId
   * @param transactions
   * @private
   */
  private sendTransactions(
    chainId: number,
    transactions: TransactionRequest[],
  ): TransactionRequest {
    if (transactions.length === 1) {
      return transactions[0]
    }

    const totalValue = transactions.reduce((acc, tx) => acc + (tx.value || 0n), 0n)

    const calls = transactions.map((tx) => ({
      target: tx.to!,
      allowFailure: false,
      value: tx.value ?? 0n,
      callData: tx.data ?? '0x',
    }))

    const data = encodeFunctionData({
      abi: Multicall3Abi,
      functionName: 'aggregate3Value',
      args: [calls],
    })

    return { to: getMulticall(chainId), value: totalValue, data }
  }

  /**
   * Get all unique intent source addresses across all chains
   * @returns Array of unique intent source addresses
   */
  private getAllIntentSourceAddresses(): Hex[] {
    const intentSources = this.ecoConfigService.getIntentSources()
    return _.uniq(_.map(intentSources, 'sourceAddress'))
  }

  /**
   * Get all unique inbox addresses across all chains
   * @returns Array of unique inbox addresses
   */
  private getAllInboxAddresses(): Hex[] {
    const intentSources = this.ecoConfigService.getIntentSources()
    return _.uniq(_.map(intentSources, 'inbox'))
  }

  /**
   * Get intent source configuration by chain ID
   * @param chainId The chain ID to get intent source for
   * @returns The intent source configuration or undefined if not found
   */
  private getIntentSourceByChainId(chainId: number): IntentSource | undefined {
    return this.ecoConfigService.getIntentSource(chainId)
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
