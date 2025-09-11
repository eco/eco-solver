import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, OnApplicationBootstrap } from '@nestjs/common'
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
import { IntentOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
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
import { QUEUES } from '@/common/redis/constants'
import { ExecuteSendBatchJobData } from '@/intent-processor/jobs/execute-send-batch.job'
import { Multicall3Abi } from '@/contracts/Multicall3'
import { getMulticall } from '@/intent-processor/utils/multicall'
import { getChainConfig } from '@/eco-configs/utils'

@Injectable()
export class IntentProcessorService implements OnApplicationBootstrap {
  private logger = new IntentOperationLogger('IntentProcessorService')

  private config: {
    sendBatch: SendBatchConfig
    hyperlane: HyperlaneConfig
    withdrawals: WithdrawsConfig
  }
  private readonly intentProcessorQueue: IntentProcessorQueue

  constructor(
    @InjectQueue(QUEUES.INTENT_PROCESSOR.queue)
    queue: IntentProcessorQueueType,
    private readonly ecoConfigService: EcoConfigService,
    private readonly indexerService: IndexerService,
    private readonly walletClientDefaultSignerService: WalletClientDefaultSignerService,
  ) {
    this.intentProcessorQueue = new IntentProcessorQueue(queue)
  }

  @LogOperation('intent_processing', IntentOperationLogger)
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

  @LogOperation('intent_processing', IntentOperationLogger)
  async getNextBatchWithdrawals() {
    const intentSourceAddrs = this.getIntentSource()

    const batches = await Promise.all(
      intentSourceAddrs.map(async (addr) => {
        const withdrawals = await this.indexerService.getNextBatchWithdrawals(addr)
        return withdrawals.map((withdrawal) => ({ ...withdrawal, intentSourceAddr: addr }))
      }),
    )
    const batchWithdrawals = batches.flat()

    const batchWithdrawalsPerSource = _.groupBy(
      batchWithdrawals,
      (withdrawal) => withdrawal.intent.source,
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

    // Log business event for batch withdrawal processing
    batchWithdrawals.forEach((withdrawal) => {
      this.logger.logIntentStatusTransition(
        withdrawal.intent.hash,
        'pending',
        'queued_for_withdrawal',
        'batch_processing_scheduled',
      )
    })

    this.intentProcessorQueue.addExecuteWithdrawalsJobs(jobsData)
  }

  @LogOperation('intent_processing', IntentOperationLogger)
  async getNextSendBatch() {
    const intentSourceAddrs = this.getIntentSource()

    const allProvesWithAddr = await Promise.all(
      intentSourceAddrs.map(async (addr) => {
        const proves = await this.indexerService.getNextSendBatch(addr)
        return proves.map((prove) => ({ ...prove, intentSourceAddr: addr }))
      }),
    )
    const proves = allProvesWithAddr.flat()

    const batchProvesPerChain = _.groupBy(proves, (prove) => prove.destinationChainId)

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

    // Log business event for send batch processing
    proves.forEach((prove) => {
      this.logger.logIntentStatusTransition(
        prove.hash,
        'proven',
        'queued_for_send_batch',
        'send_batch_processing_scheduled',
      )
    })

    await this.intentProcessorQueue.addExecuteSendBatchJobs(jobsData)
  }

  @LogOperation('intent_processing', IntentOperationLogger)
  async executeWithdrawals(@LogContext data: ExecuteWithdrawsJobData) {
    const { intents, intentSourceAddr, chainId } = data

    const walletClient = await this.walletClientDefaultSignerService.getClient(chainId)
    const publicClient = await this.walletClientDefaultSignerService.getPublicClient(chainId)

    const txHash = await walletClient.writeContract({
      abi: IntentSourceAbi,
      address: intentSourceAddr,
      args: [intents],
      functionName: 'batchWithdraw',
    })

    // Log business event for withdrawal execution
    intents.forEach((intent: any) => {
      this.logger.logIntentStatusTransition(
        intent.hash || 'unknown',
        'queued_for_withdrawal',
        'withdrawal_executed',
        `transaction_sent_${txHash}`,
      )
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })
  }

  @LogOperation('intent_processing', IntentOperationLogger)
  async executeSendBatch(@LogContext data: ExecuteSendBatchJobData) {
    const { proves, chainId, inbox: inboxAddr } = data

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

    const transaction = this.sendTransactions(chainId, sendBatchTransactions)

    const txHash = await walletClient.sendTransaction(transaction)

    // Log business event for send batch execution
    proves.forEach((prove) => {
      this.logger.logIntentStatusTransition(
        prove.hash,
        'queued_for_send_batch',
        'send_batch_executed',
        `transaction_sent_${txHash}`,
      )
    })

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
    @LogContext publicClient: PublicClient<Transport, Chain>,
    @LogContext inbox: Hex,
    @LogContext prover: Hex,
    @LogContext source: number,
    @LogContext intentHashes: Hex[],
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
    @LogContext inbox: Hex,
    @LogContext prover: Hex,
    @LogContext origin: number,
    @LogContext source: number,
    @LogContext messageData: Hex,
    @LogContext intentCount: number,
  ): Promise<bigint> {
    try {
      const { mailbox } = Hyperlane.getChainMetadata(this.config.hyperlane, source)

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
      // Log business event for gas estimation failure
      this.logger.logFeasibilityCheckFailure(
        { hash: 'gas_estimation', source, destination: origin },
        'final_feasibility',
        error,
      )

      // Estimate 25k gas per intent
      return BigInt(this.config.sendBatch.defaultGasPerIntent) * BigInt(intentCount)
    }
  }
}
