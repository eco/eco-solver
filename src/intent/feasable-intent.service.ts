import { EcoAnalyticsService } from '@/analytics'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { ERROR_EVENTS } from '@/analytics/events.constants'
import { FeeService } from '@/fee/fee.service'
import { getIntentJobId } from '../common/utils/strings'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { IntentProcessingJobData } from '@/intent/interfaces/intent-processing-job-data.interface'
import { JobsOptions, Queue } from 'bullmq'
import { QUEUES } from '../common/redis/constants'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { UtilsIntentService } from './utils-intent.service'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class FeasableIntentService implements OnModuleInit {
  private logger = new Logger(FeasableIntentService.name)
  private intentJobConfig: JobsOptions
  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    private readonly feeService: FeeService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  async onModuleInit() {
    this.intentJobConfig = this.ecoConfigService.getRedis().jobs.intentJobConfig
  }
  async feasableQuote(quoteIntent: QuoteIntentModel) {
    try {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `feasableQuote intent ${quoteIntent._id}`,
        }),
      )

      // TODO: Add actual feasibility logic here

      this.ecoAnalytics.trackQuoteFeasibilityCheckSuccess(quoteIntent)
    } catch (error) {
      this.ecoAnalytics.trackQuoteFeasibilityCheckError(quoteIntent, error)
      throw error
    }
  }

  async feasableIntent(data: IntentProcessingJobData) {
    const { intentHash, isNegativeIntent } = data

    if (isNegativeIntent) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Intent ${intentHash} is a negative intent, skipping feasibility check`,
        }),
      )

      await this.addFulfillJob(data)
      return true
    }

    return this._feasableIntent(data)
  }

  /**
   * Validates that the execution of the intent is feasible. This means that the solver can execute
   * the transaction and that transaction cost is profitable to the solver.
   * @param intentHash the intent hash to fetch the intent data from the db with
   * @returns
   */
  private async _feasableIntent(intentProcessingJobData: IntentProcessingJobData) {
    const { intentHash } = intentProcessingJobData
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `FeasableIntent intent ${intentHash}`,
      }),
    )

    // Track feasibility check start
    this.ecoAnalytics.trackIntentFeasibilityCheckStarted(intentHash)

    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, solver, err } = data ?? {}
    if (!model || !solver) {
      // Track feasibility check failed due to missing data
      this.ecoAnalytics.trackError(
        ERROR_EVENTS.INTENT_FEASIBILITY_CHECK_FAILED,
        err || new Error('missing_model_or_solver'),
        {
          intentHash,
          reason: 'missing_model_or_solver',
          stage: 'data_retrieval',
        },
      )
      if (err) {
        throw err
      }
      return
    }

    const { error } = await this.feeService.isRouteFeasible(model.intent)

    const jobId = getIntentJobId('feasable', intentHash, model!.intent.logIndex)
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `FeasableIntent intent ${intentHash}`,
        properties: {
          feasable: !error,
          ...(!error ? { jobId } : {}),
        },
      }),
    )
    if (!error) {
      //add to processing queue
      await this.intentQueue.add(
        QUEUES.SOURCE_INTENT.jobs.fulfill_intent,
        intentProcessingJobData,
        {
          jobId,
          ...this.intentJobConfig,
        },
      )

      // Track feasible intent queued for fulfillment
      this.ecoAnalytics.trackIntentFeasibleAndQueued(intentHash, jobId, model)
    } else {
      await this.utilsIntentService.updateInfeasableIntentModel(model, error)

      // Track infeasible intent
      this.ecoAnalytics.trackIntentInfeasible(intentHash, model, error)
    }
  }

  private async addFulfillJob(data: IntentProcessingJobData, logIndex: number = 0) {
    const { intentHash } = data
    const jobId = getIntentJobId('feasable', intentHash, logIndex)
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `FeasableIntent intent ${intentHash}`,
        properties: {
          intentHash,
          jobId,
        },
      }),
    )

    // Add to processing queue
    await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.fulfill_intent, data, {
      jobId,
      ...this.intentJobConfig,
    })
  }
}
