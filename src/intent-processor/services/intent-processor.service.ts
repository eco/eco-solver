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
import { InboxAbi } from '@eco-foundation/routes-ts'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { HyperlaneConfig, SendBatchConfig, WithdrawsConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { IndexerService } from '@/indexer/services/indexer.service'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import * as Hyperlane from '@/intent-processor/utils/hyperlane'
import { getWithdrawData } from '@/intent-processor/utils/intent'
import { ExecuteWithdrawsJobData } from '@/intent-processor/jobs/execute-withdraws.job'
import { isGaslessIntent } from '@/intent-processor/utils/gasless'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import {
  BatchWithdrawGasless,
  BatchWithdraws,
} from '@/indexer/interfaces/batch-withdraws.interface'
import {
  IntentProcessorQueue,
  IntentProcessorQueueType,
} from '@/intent-processor/queues/intent-processor.queue'
import { ExecuteSendBatchJobData } from '@/intent-processor/jobs/execute-send-batch.job'
import { batchTransactionsWithMulticall } from '@/common/multicall/multicall3'
import { getChainConfig } from '@/eco-configs/utils'
import { portalAbi } from '@/contracts/v2-abi/Portal'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { PortalHashUtils } from '@/common/utils/portal'

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
    private readonly intentSourceRepository: IntentSourceRepository,
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
    // Separate gasless and regular intents for processing
    const gaslessWithdrawals = batchWithdrawals.filter(isGaslessIntent) as (BatchWithdrawGasless & {
      intentSourceAddr: Hex
    })[]
    const regularWithdrawals = batchWithdrawals
      .filter((w) => !isGaslessIntent(w))
      .map((item) => {
        const w = item as BatchWithdraws
        return { ...getWithdrawData(w.intent), intentSourceAddr: item.intentSourceAddr }
      })

    // Get all gasless intent hashes
    const gaslessIntentHashes = gaslessWithdrawals.map((g) => g.intent.intentHash)

    // Fetch full data for all gasless intents from MongoDB in a single query
    const gaslessIntentsFromDb =
      await this.intentSourceRepository.getIntentsByHashes(gaslessIntentHashes)

    // Create a map for quick lookup
    const gaslessIntentsMap = new Map(
      gaslessIntentsFromDb.map((intent) => [intent.intent.hash as string, intent]),
    )

    // Map gasless withdrawals with their full data
    const gaslessWithdrawalsWithData = gaslessWithdrawals
      .map((gaslessWithdrawal) => {
        const fullIntent = gaslessIntentsMap.get(gaslessWithdrawal.intent.intentHash)
        if (!fullIntent) {
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message: `Gasless intent not found in the database: ${gaslessWithdrawal.intent.intentHash}`,
            }),
          )
          return null
        }

        const intent = IntentDataModel.toIntentV2(fullIntent.intent)
        const { routeHash } = PortalHashUtils.getIntentHash(intent)

        return {
          source: BigInt(fullIntent.intent.route.source),
          destination: BigInt(fullIntent.intent.route.destination),
          routeHash,
          reward: intent.reward,
          intentSourceAddr: gaslessWithdrawal.intentSourceAddr,
        }
      })
      .filter((w) => w !== null)

    // Combine regular and gasless withdrawals
    const allWithdrawalsWithData = [...regularWithdrawals, ...gaslessWithdrawalsWithData]

    const batchWithdrawalsPerSource = _.groupBy(
      allWithdrawalsWithData,
      (withdrawal) => withdrawal.source,
    )

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.getNextBatchWithdrawals(): Withdrawals`,
        properties: {
          intentSourceAddrs,
          intentHashes: _.map(batchWithdrawals, (withdrawal) => withdrawal.claimant._hash),
        },
      }),
    )

    const jobsData: ExecuteWithdrawsJobData[] = []

    for (const sourceChainId in batchWithdrawalsPerSource) {
      const withdrawalsForChain = batchWithdrawalsPerSource[sourceChainId]

      const chunkWithdrawals = _.chunk(withdrawalsForChain, this.config.withdrawals.chunkSize)
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
            withdrawals: chunk,
          })
        }
      })
    }

    this.intentProcessorQueue.addExecuteWithdrawalsJobs(jobsData)
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

    await this.intentProcessorQueue.addExecuteSendBatchJobs(jobsData)
  }

  async executeWithdrawals(data: ExecuteWithdrawsJobData) {
    const { withdrawals, intentSourceAddr, chainId } = data

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${IntentProcessorService.name}.executeWithdrawals(): Withdrawals`,
        properties: {
          chainId: data.chainId,
          intentSourceAddr: data.intentSourceAddr,
          routeHash: withdrawals,
        },
      }),
    )

    const walletClient = await this.walletClientDefaultSignerService.getClient(chainId)
    const publicClient = await this.walletClientDefaultSignerService.getPublicClient(chainId)

    const destinations = withdrawals.map((w) => w.destination)
    const routeHashes = withdrawals.map((w) => w.routeHash)
    const rewards = withdrawals.map((w) => w.reward)

    const txHash = await walletClient.writeContract({
      abi: portalAbi,
      address: intentSourceAddr,
      args: [destinations, routeHashes, rewards],
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

  private getChainIdForIntentSource(intentSourceAddr: Hex): number {
    const intentSources = this.ecoConfigService.getIntentSources()
    const intentSource = intentSources.find((source) => source.sourceAddress === intentSourceAddr)

    if (!intentSource) {
      throw new Error(`Intent source not found for address: ${intentSourceAddr}`)
    }

    return intentSource.chainID
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
      [
        {
          type: 'tuple',
          components: [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
        },
      ],
      [[pad(prover), metadata, aggregationHook]],
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
