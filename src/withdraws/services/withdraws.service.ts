import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import * as _ from 'lodash'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { WithdrawsConfig } from '@/eco-configs/eco-config.types'
import { IndexerService } from '@/indexer/services/indexer.service'
import { getWithdrawData } from '@/withdraws/utils/intent'
import { ExecuteWithdrawsJobData } from '@/withdraws/jobs/execute-withdraws.job'
import { WithdrawsQueue, WithdrawsQueueType } from '@/withdraws/queues/withdraws.queue'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { RewardInterface } from '@/indexer/interfaces/reward.interface'
import { DeepReadonly } from '@/common/types/deep-readonly'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { serialize } from '@/common/utils/serialize'

@Injectable()
export class WithdrawsService implements OnApplicationBootstrap {
  private logger = new Logger(WithdrawsService.name)

  private config: WithdrawsConfig
  private readonly withdrawsQueue: WithdrawsQueue

  constructor(
    @InjectQueue(WithdrawsQueue.queueName)
    queue: WithdrawsQueueType,
    private readonly ecoConfigService: EcoConfigService,
    private readonly indexerService: IndexerService,
    private readonly walletClientDefaultSignerService: WalletClientDefaultSignerService,
  ) {
    this.withdrawsQueue = new WithdrawsQueue(queue)
  }

  onApplicationBootstrap() {
    this.config = this.ecoConfigService.getWithdraws()
    return this.withdrawsQueue.startCronJobs(this.config.intervalDuration)
  }

  async getNextBatchWithdrawals() {
    const intentSources = this.ecoConfigService.getIntentSources()
    const uniqIntentSources = _.uniq(_.map(intentSources, 'sourceAddress'))

    if (uniqIntentSources.length > 1) {
      throw new Error(
        'Implementation has to be refactor to support multiple intent source addresses.',
      )
    }

    const intentSourceAddr = uniqIntentSources[0]

    const batchWithdrawals = await this.indexerService.getNextBatchWithdrawals(intentSourceAddr)
    const batchWithdrawalsPerSource = _.groupBy(
      batchWithdrawals,
      (withdrawal) => withdrawal.intent.source,
    )

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${WithdrawsService.name}.getNextBatchWithdrawals(): Withdrawals`,
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

      const chunkWithdrawals = _.chunk(batchWithdrawalsData, this.config.chunkSize)

      // Set a maximum number of withdrawals per transaction
      chunkWithdrawals.forEach((chunk) => {
        jobsData.push({ chainId: parseInt(sourceChainId), intentSourceAddr, intents: chunk })
      })
    }

    this.withdrawsQueue.addExecuteWithdrawalsJobs(jobsData)
  }

  async executeWithdrawals(data: ExecuteWithdrawsJobData) {
    const { intents, intentSourceAddr, chainId } = data

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${WithdrawsService.name}.executeWithdrawals(): Withdrawals`,
        properties: {
          chainId: data.chainId,
          intentSourceAddr: data.intentSourceAddr,
          routeHash: data.intents.map((intent) => intent.routeHash),
        },
      }),
    )

    const walletClient = await this.walletClientDefaultSignerService.getClient(chainId)
    const publicClient = await this.walletClientDefaultSignerService.getPublicClient(chainId)

    const routeHashes = _.map(intents, 'routeHash')
    const rewards: DeepReadonly<RewardInterface[]> = _.map(intents, 'reward')

    const txHash = await walletClient.writeContract({
      abi: IntentSourceAbi,
      address: intentSourceAddr,
      args: [routeHashes, rewards],
      functionName: 'batchWithdraw',
    })

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${WithdrawsService.name}.executeWithdrawals(): Transaction sent`,
        properties: {
          chainId: data.chainId,
          transactionHash: txHash,
        },
      }),
    )

    await publicClient.waitForTransactionReceipt({ hash: txHash })
  }
}
