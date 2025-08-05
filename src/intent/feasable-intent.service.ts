import { EcoAnalyticsService } from '@/analytics'
import { EcoLogMessage } from '../common/logging/eco-log-message'
import { ERROR_EVENTS } from '@/analytics/events.constants'
import { FeeService } from '@/fee/fee.service'
import { getIntentJobId } from '../common/utils/strings'
import { Hex } from 'viem'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { IntentProcessingJobData } from '@/intent/interfaces/intent-processing-job-data.interface'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { ModuleRef } from '@nestjs/core'
import { NegativeIntentAnalyzerService } from '@/negative-intents/services/negative-intents-analyzer.service'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { UtilsIntentService } from './utils-intent.service'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class FeasableIntentService implements OnModuleInit {
  private logger = new Logger(FeasableIntentService.name)
  private negativeIntentAnalyzerService: NegativeIntentAnalyzerService

  constructor(
    private readonly intentFulfillmentQueue: IntentFulfillmentQueue,
    private readonly feeService: FeeService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoAnalytics: EcoAnalyticsService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    this.negativeIntentAnalyzerService = this.moduleRef.get(NegativeIntentAnalyzerService, {
      strict: false,
    })
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

  /**
   * Validates that the execution of the intent is feasible. This means that the solver can execute
   * the transaction and that transaction cost is profitable to the solver.
   * @param data the intent processing job data containing the intent hash and other necessary information
   * @returns
   */
  async feasableIntent(data: IntentProcessingJobData) {
    const { intentHash } = data
    const isNegativeIntent = await this.isNegativeIntent(data)

    if (isNegativeIntent) {
      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: `Intent ${intentHash} is a negative intent, skipping feasibility check`,
        }),
      )

      const model = await this.getIntentSourceModel(intentHash)

      if (!model) {
        return
      }

      const chainID = Number(model.intent.route.destination)
      await this.addFulfillJob(data, chainID)
      return true
    }

    return this._feasableIntent(data)
  }

  async isNegativeIntent(data: IntentProcessingJobData): Promise<boolean> {
    const { intentHash } = data
    let isNegativeIntent = data.isNegativeIntent

    if (!isNegativeIntent) {
      isNegativeIntent = await this.negativeIntentAnalyzerService.isNegativeIntentHash(intentHash)
    }

    return isNegativeIntent
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

    const model = await this.getIntentSourceModel(intentHash)

    if (!model) {
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
      await this.intentFulfillmentQueue.addFulfillIntentJob({
        intentHash,
        chainId: Number(model.intent.route.destination),
      })

      // Track feasible intent queued for fulfillment
      this.ecoAnalytics.trackIntentFeasibleAndQueued(intentHash, jobId, model)
    } else {
      await this.utilsIntentService.updateInfeasableIntentModel(model, error)

      // Track infeasible intent
      this.ecoAnalytics.trackIntentInfeasible(intentHash, model, error)
    }
  }

  private async addFulfillJob(data: IntentProcessingJobData, chainID: number) {
    const { intentHash } = data
    const jobId = getIntentJobId('feasable', intentHash, chainID)
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
    await this.intentFulfillmentQueue.addFulfillIntentJob({
      intentHash,
      chainId: chainID,
    })
  }

  private async getIntentSourceModel(intentHash: Hex): Promise<IntentSourceModel | undefined> {
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
      return undefined
    }

    return model
  }
}
