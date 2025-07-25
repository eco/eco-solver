import { zeroAddress, Hex, parseUnits } from 'viem'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'
import { ExecuteWithdrawsJobData } from '@/intent-processor/jobs/execute-withdraws.job'
import { getIntentJobId } from '@/common/utils/strings'
import { Injectable } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import {
  IntentFilter,
  IntentSourceRepository,
} from '@/intent/repositories/intent-source.repository'
import { IntentProcessingJobData } from '@/intent/interfaces/intent-processing-job-data.interface'
import { IntentProcessorService } from '@/intent-processor/services/intent-processor.service'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { JobsOptions, Queue } from 'bullmq'
import {
  NegativeIntentAnalyzerService,
  RankedIntent,
} from '@/negative-intents/services/negative-intents-analyzer.service'
import { QUEUES } from '@/common/redis/constants'
import {
  TokenData,
  RebalanceQuote,
  PublicNegativeIntentContext,
} from '@/liquidity-manager/types/types'

type PublicNegativeIntent = 'PublicNegativeIntent'

@Injectable()
export class PublicNegativeIntentRebalanceService
  implements IRebalanceProvider<PublicNegativeIntent>
{
  private logger = new EcoLogger(PublicNegativeIntentRebalanceService.name)
  private intentJobConfig: JobsOptions

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    private readonly ecoConfigService: EcoConfigService,
    private readonly negativeIntentAnalyzerService: NegativeIntentAnalyzerService,
    private readonly intentSourceRepository: IntentSourceRepository,
    private readonly intentProcessorService: IntentProcessorService,
  ) {}

  async onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
  }

  getStrategy(): PublicNegativeIntent {
    return 'PublicNegativeIntent'
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    rawSwapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<PublicNegativeIntent> | RebalanceQuote<PublicNegativeIntent>[]> {
    const swapAmount = parseUnits(rawSwapAmount.toString(), tokenIn.balance.decimals)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${PublicNegativeIntentRebalanceService.name}.getQuote`,
        properties: {
          tokenIn,
          tokenOut,
          rawSwapAmount,
          swapAmount,
        },
      }),
    )

    // - Query intents by routeToken = tokenIn.config.address and rewardToken = tokenOut.config.address
    const intentFilter: IntentFilter = {
      status: 'PENDING',
      routeToken: tokenIn.config.address,
      rewardToken: tokenOut.config.address,
      requireNonExpired: true,
      requireTransferSelector: true,
      requireZeroCallValue: true,
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `getQuote`,
        properties: {
          intentFilter,
        },
      }),
    )

    const negativeIntents = await this.getNegativeIntents(intentFilter)

    if (negativeIntents.length === 0) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `${PublicNegativeIntentRebalanceService.name}.getQuote: no negative intents found`,
        }),
      )

      return []
    }

    // Accumulate intents until we reach swapAmount
    const selected: RankedIntent[] = []
    let accumulated = 0n

    for (const intent of negativeIntents) {
      if (accumulated >= swapAmount) {
        break
      }

      selected.push(intent)
      accumulated += intent.routeAmount
    }

    if (selected.length === 0) {
      return []
    }

    const totalIn = selected.reduce((sum, i) => sum + i.routeAmount, 0n)
    const totalOut = selected.reduce((sum, i) => sum + i.rewardAmount, 0n)
    const avgSlippage = NegativeIntentAnalyzerService.getSlippage(totalOut, totalIn)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${PublicNegativeIntentRebalanceService.name}.getQuote: selected`,
        properties: {
          // selected,
          accumulated,
          totalIn,
          totalOut,
          avgSlippage,
        },
      }),
    )

    const context: PublicNegativeIntentContext = {
      intentHashes: selected.map((rankedIntent) => rankedIntent.intentSource.intent.hash),
    }

    const quote: RebalanceQuote<PublicNegativeIntent> = {
      tokenIn,
      tokenOut,
      amountIn: totalIn,
      amountOut: totalOut,
      slippage: avgSlippage,
      strategy: this.getStrategy(),
      context,
      id,
    }

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${PublicNegativeIntentRebalanceService.name}.getQuote: returning quote`,
        properties: {
          quote,
        },
      }),
    )

    return quote
  }

  private async getNegativeIntents(intentFilter: IntentFilter): Promise<RankedIntent[]> {
    const intents = await this.intentSourceRepository.filterIntents(intentFilter)

    if (intents.length === 0) {
      return []
    }

    // Filter and rank negative intents
    const { ranked } = this.negativeIntentAnalyzerService.rankIntents(intents)
    return ranked
  }

  async execute(
    walletAddress: string,
    quote: RebalanceQuote<PublicNegativeIntent>,
  ): Promise<EcoResponse<number>> {
    const { intentHashes } = quote.context

    for (const hash of intentHashes) {
      // Fetch the intent by hash from DB
      const intent = await this.intentSourceRepository.getIntent(hash)

      if (!intent) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `${PublicNegativeIntentRebalanceService.name}.execute: intent not found for hash: ${hash}`,
            properties: {
              intentHash: hash,
              walletAddress,
            },
          }),
        )

        continue
      }

      // Fulfill intent
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `${PublicNegativeIntentRebalanceService.name}.execute: adding fulfill job for intent: ${hash}`,
          properties: {
            intentHash: hash,
            walletAddress,
          },
        }),
      )

      await this.addValidateJob(hash)
    }

    return { response: intentHashes.length }
  }

  async processIntentProven(data: IntentProcessingJobData): Promise<void> {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${PublicNegativeIntentRebalanceService.name}.processIntentProven`,
        properties: {
          data,
        },
      }),
    )

    const { intentHash } = data
    const intentSourceModel = await this.intentSourceRepository.getIntent(intentHash)

    if (!intentSourceModel) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `${PublicNegativeIntentRebalanceService.name}.processIntentProven: intent not found for hash: ${intentHash}`,
        }),
      )
      return
    }

    const { response: analysisResult, error } =
      this.negativeIntentAnalyzerService.analyzeIntent(intentSourceModel)

    if (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `processIntentProven: failed to analyze intent ${intentHash}`,
          properties: {
            error: error.message || error,
            intentHash,
          },
        }),
      )
      return
    }

    if (!analysisResult!.isNegative) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `${PublicNegativeIntentRebalanceService.name}.processIntentProven: intent ${intentHash} is not negative, skipping`,
          properties: { intentHash },
        }),
      )
      return
    }

    // Withdraw rewards
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${PublicNegativeIntentRebalanceService.name}.processIntentProven: about to withdraw rewards for intent: ${intentHash}`,
        properties: { intentHash },
      }),
    )

    const intent = IntentDataModel.toChainIntent(intentSourceModel.intent)
    const sourceChainID = intent.route.source

    const executeWithdrawsJobData: ExecuteWithdrawsJobData = {
      chainId: Number(sourceChainID),
      intentSourceAddr: zeroAddress,
      intents: [IntentDataModel.toChainIntent(intentSourceModel.intent)],
    }

    const job = await this.intentProcessorService.addExecuteWithdrawalsJob(executeWithdrawsJobData)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `${PublicNegativeIntentRebalanceService.name}.processIntentProven: withdraw rewards for intent: ${intentHash} job added`,
        properties: {
          job,
        },
      }),
    )
  }

  private async addValidateJob(intentHash: Hex) {
    const jobId = getIntentJobId(PublicNegativeIntentRebalanceService.name, intentHash)

    const data: IntentProcessingJobData = {
      intentHash,
      isNegativeIntent: true,
    }

    // Add to processing queue
    await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.validate_intent, data, {
      jobId,
      ...this.intentJobConfig,
    })
  }
}
