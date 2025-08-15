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
import { InboxAbi, IntentSourceAbi } from '@eco/foundation-eco-adapter'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { HyperlaneConfig, SendBatchConfig, WithdrawsConfig } from '@eco/infrastructure-config'
import { EcoConfigService } from '@eco/infrastructure-config'
import { IndexerService } from '@/indexer/services/indexer.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import * as Hyperlane from '@/intent-processor/utils/hyperlane'
import { getWithdrawData } from '@/intent-processor/utils/intent'
import { ExecuteWithdrawsJobData } from '@/intent-processor/types'
import {
  IntentProcessorQueue,
  IntentProcessorQueueType,
} from '@/intent-processor/queues/intent-processor.queue'
import { ExecuteSendBatchJobData } from '@/intent-processor/types'
import { Multicall3Abi } from '@/contracts/Multicall3'
import { getMulticall } from '@/intent-processor/utils/multicall'
import { getChainConfig } from '@eco/infrastructure-config'
import { IntentProcessorJobFactory } from '@/intent-processor/factories/job.factory'

@Injectable()
export class IntentProcessorService implements OnApplicationBootstrap {
  private logger = new Logger(IntentProcessorService.name)

  private config!: {
    sendBatch: SendBatchConfig
    hyperlane: HyperlaneConfig
    withdrawals: WithdrawsConfig
  }
  private readonly intentProcessorQueue: IntentProcessorQueue
  private readonly jobFactory: IntentProcessorJobFactory

  constructor(
    @InjectQueue(IntentProcessorQueue.queueName)
    queue: IntentProcessorQueueType,
    private readonly ecoConfigService: EcoConfigService,
    private readonly indexerService: IndexerService,
    private readonly walletClientDefaultSignerService: WalletClientDefaultSignerService,
  ) {
    this.intentProcessorQueue = new IntentProcessorQueue(queue)
    this.jobFactory = new IntentProcessorJobFactory(queue)
  }

  async onApplicationBootstrap() {
    this.config = {
      sendBatch: this.ecoConfigService.getSendBatch(),
      hyperlane: this.ecoConfigService.getHyperlane(),
      withdrawals: this.ecoConfigService.getWithdraws(),
    }
    await this.jobFactory.startWithdrawalsCronJobs(
      this.config.withdrawals.intervalDuration,
    )
    await this.jobFactory.startSendBatchCronJobs(this.config.sendBatch.intervalDuration)
  }

  async getNextBatchWithdrawals() {
    const intentSourceAddrs = this.getIntentSource()

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getNextBatchWithdrawals(): Intent source addresses`,
        properties: {
          intentSourceAddrs,
          count: intentSourceAddrs.length,
        },
      }),
    )

    const batches = await Promise.all(
      intentSourceAddrs.map(async (addr) => {
        const withdrawals = await this.indexerService.getNextBatchWithdrawals(addr)
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `${IntentProcessorService.name}.getNextBatchWithdrawals(): Per address result`,
            properties: {
              addr,
              withdrawalsCount: withdrawals.length,
            },
          }),
        )
        return withdrawals.map((withdrawal) => ({ ...withdrawal, intentSourceAddr: addr }))
      }),
    )
    const batchWithdrawals = batches.flat()

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getNextBatchWithdrawals(): Flattened results`,
        properties: {
          totalWithdrawals: batchWithdrawals.length,
        },
      }),
    )
    const batchWithdrawalsPerSource = _.groupBy(
      batchWithdrawals,
      (withdrawal) => withdrawal.intent.source,
    )

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getNextBatchWithdrawals(): Withdrawals`,
        properties: {
          intentSourceAddrs,
          intentHashes: _.map(batchWithdrawals, (withdrawal) => withdrawal.intent.hash),
        },
      }),
    )

    const jobsData: ExecuteWithdrawsJobData[] = []

    for (const sourceChainId in batchWithdrawalsPerSource) {
      const withdrawalsForChain = batchWithdrawalsPerSource[sourceChainId]
      const batchWithdrawalsData = withdrawalsForChain.map(({ intent }) => getWithdrawData(intent))

      const chunkWithdrawals = _.chunk(batchWithdrawalsData, this.config.withdrawals.chunkSize)
      const chunkWithdrawalsWithAddr = _.chunk(
        withdrawalsForChain,
        this.config.withdrawals.chunkSize,
      )

      // Set a maximum number of withdrawals per transaction
      chunkWithdrawals.forEach((chunk, index) => {
        const withdrawalChunk = chunkWithdrawalsWithAddr[index]
        if (withdrawalChunk && withdrawalChunk.length > 0) {
          const intentSourceAddr = withdrawalChunk[0].intentSourceAddr
          jobsData.push({
            chainId: parseInt(sourceChainId),
            intentSourceAddr,
            intents: chunk,
          })
        }
      })
    }

    await this.jobFactory.addExecuteWithdrawalsJobs(jobsData)
  }

  async getNextSendBatch() {
    const intentSourceAddrs = this.getIntentSource()

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getNextSendBatch(): Intent source addresses`,
        properties: {
          intentSourceAddrs,
          count: intentSourceAddrs.length,
        },
      }),
    )

    const allProvesWithAddr = await Promise.all(
      intentSourceAddrs.map(async (addr) => {
        const proves = await this.indexerService.getNextSendBatch(addr)
        this.logger.debug(
          EcoLogMessage.fromDefault({
            message: `${IntentProcessorService.name}.getNextSendBatch(): Per address result`,
            properties: {
              addr,
              provesCount: proves.length,
            },
          }),
        )
        return proves.map((prove) => ({ ...prove, intentSourceAddr: addr }))
      }),
    )
    const proves = allProvesWithAddr.flat()

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getNextSendBatch(): Flattened results`,
        properties: {
          totalProves: proves.length,
        },
      }),
    )
    const batchProvesPerChain = _.groupBy(proves, (prove) => prove.destinationChainId)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getNextSendBatch(): Send batches`,
        properties: {
          intentSourceAddrs,
          intentHashes: _.map(proves, (prove) => prove.hash),
        },
      }),
    )

    const jobsData: ExecuteSendBatchJobData[] = []

    for (const chainId in batchProvesPerChain) {
      const provesForChain = batchProvesPerChain[chainId]

      // Group by intent source address to ensure each job has a single intent source
      const provesByIntentSource = _.groupBy(provesForChain, (prove) => prove.intentSourceAddr)

      for (const intentSourceAddr in provesByIntentSource) {
        const provesForSource = provesByIntentSource[intentSourceAddr]
        const inbox = this.getInboxForIntentSource(intentSourceAddr as Hex)

        const sendBatchData = provesForSource.map((prove) => ({
          hash: prove.hash,
          prover: prove.prover,
          source: prove.chainId,
          intentSourceAddr: prove.intentSourceAddr,
          inbox,
        }))

        // A Batch must contain the same prover and destination
        // Batch is sorted to contain as many send batches as possible per chunk
        const sortedBatch = _.sortBy(sendBatchData, (data) => [data.prover, data.source].join('-'))

        const chunkExecutions = _.chunk(sortedBatch, this.config.sendBatch.chunkSize)

        // Set a maximum number of withdrawals per transaction
        chunkExecutions.forEach((chunkExecution) => {
          jobsData.push({
            chainId: parseInt(chainId),
            intentSourceAddr: intentSourceAddr as Hex,
            inbox,
            proves: chunkExecution,
          })
        })
      }
    }

    await this.jobFactory.addExecuteSendBatchJobs(jobsData)
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
    const { proves, chainId, inbox: inboxAddr } = data

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.executeSendBatch(): Send batch`,
        properties: { chainId, routeHash: _.map(proves, 'hash') },
      }),
    )

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

  private getIntentSource() {
    const intentSources = this.ecoConfigService.getIntentSources()
    const uniqIntentSources = _.uniq(_.map(intentSources, 'sourceAddress'))

    return uniqIntentSources
  }

  private getInboxForIntentSource(intentSourceAddr: Hex): Hex {
    const intentSources = this.ecoConfigService.getIntentSources()
    const intentSource = intentSources.find((source) => source.sourceAddress === intentSourceAddr)

    if (!intentSource) {
      throw new Error(`Intent source not found for address: ${intentSourceAddr}`)
    }

    return intentSource.inbox
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
          properties: { error: (error as Error).message },
        }),
      )

      // Estimate 25k gas per intent
      return BigInt(this.config.sendBatch.defaultGasPerIntent) * BigInt(intentCount)
    }
  }
}
