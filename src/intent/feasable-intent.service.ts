import { Injectable } from '@nestjs/common'
import { UtilsIntentService } from './utils-intent.service'
import { IntentOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { getIntentJobId } from '../common/utils/strings'
import { Hex } from 'viem'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { FeeService } from '@/fee/fee.service'
import { EcoAnalyticsService } from '@/analytics'
import { ERROR_EVENTS } from '@/analytics/events.constants'
import { IntentFulfillmentQueue } from '@/intent-fulfillment/queues/intent-fulfillment.queue'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class FeasableIntentService {
  private logger = new IntentOperationLogger('FeasableIntentService')
  constructor(
    private readonly intentFulfillmentQueue: IntentFulfillmentQueue,
    private readonly feeService: FeeService,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  @LogOperation('quote_feasibility_check', IntentOperationLogger)
  async feasableQuote(@LogContext quoteIntent: QuoteIntentModel) {
    try {
      // Debug logging handled by decorator

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
   * @param intentHash the intent hash to fetch the intent data from the db with
   * @returns
   */
  @LogOperation('intent_feasibility_check', IntentOperationLogger)
  async feasableIntent(@LogContext intentHash: Hex) {
    // Debug logging handled by decorator

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

    if (!error) {
      // Log feasibility success using business event method
      this.logger.logFeasibilityCheckResult(intentHash, true, 'route_is_feasible')

      this.logger.debug({ intentHash }, `FeasableIntent intent ${intentHash}`, {
        feasable: true,
        jobId,
      })
      //add to processing queue
      await this.intentFulfillmentQueue.addFulfillIntentJob({
        intentHash,
        chainId: Number(model.intent.route.destination),
      })

      // Track feasible intent queued for fulfillment
      this.ecoAnalytics.trackIntentFeasibleAndQueued(intentHash, jobId, model)
    } else {
      // Log feasibility failure using business event method
      this.logger.logFeasibilityCheckResult(
        intentHash,
        false,
        error?.message || 'route_not_feasible',
      )

      await this.utilsIntentService.updateInfeasableIntentModel(model, error)

      // Track infeasible intent
      this.ecoAnalytics.trackIntentInfeasible(intentHash, model, error)
    }
  }
}
