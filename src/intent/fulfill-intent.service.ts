import { Injectable, Logger } from '@nestjs/common'
import { Hex } from 'viem'
import { UtilsIntentService } from './utils-intent.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Solver } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { WalletFulfillService } from '@/intent/wallet-fulfill.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { isNativeIntent } from './utils'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS, ERROR_EVENTS } from '@/analytics/events.constants'

/**
 * This class fulfills an intent by creating the transactions for the intent targets and the fulfill intent transaction.
 */
@Injectable()
export class FulfillIntentService {
  private logger = new Logger(FulfillIntentService.name)

  constructor(
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly walletFulfillService: WalletFulfillService,
    private readonly crowdLiquidityService: CrowdLiquidityService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  /**
   * Processes and fulfills a specified intent based on its type.
   *
   * @param {Hex} intentHash - The unique hash identifier of the intent to be fulfilled.
   * @return {Promise<void>} Returns the result of the fulfillment process based on the intent type.
   */
  async fulfill(intentHash: Hex): Promise<unknown> {
    // Track fulfillment attempt start
    this.ecoAnalytics.trackIntentFulfillmentStarted(intentHash)

    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, solver, err } = data ?? {}

    if (err) {
      // Track fulfillment failed due to data error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.INTENT.FULFILLMENT_FAILED, err, {
        intentHash,
        data,
        reason: 'intent_data_error',
        stage: 'data_retrieval',
      })
      throw err
    }

    if (!data || !model || !solver) {
      // Track fulfillment failed due to missing data
      this.ecoAnalytics.trackError(
        ERROR_EVENTS.INTENT_FULFILLMENT_FAILED,
        new Error('missing_model_or_solver'),
        {
          intentHash,
          data,
          model,
          solver,
          reason: 'missing_model_or_solver',
          stage: 'data_retrieval',
        },
      )
      return
    }

    if (model.status === 'SOLVED') {
      // Track already solved intent
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FULFILLMENT_SKIPPED, {
        intentHash,
        model,
        solver,
        reason: 'already_solved',
      })
      return
    }

    const isNative = isNativeIntent(model.intent)
    const { type } = isNative // disable crowd liquidity for native intents
      ? { type: 'smart-wallet-account' }
      : this.ecoConfigService.getFulfill()
    console.log("SAQUON type", type);

    // Track fulfillment method selection
    this.ecoAnalytics.trackIntentFulfillmentMethodSelected(
      intentHash,
      type || 'smart-wallet-account',
      isNative,
      model,
      solver,
    )

    switch (type) {
      case 'crowd-liquidity':
        return this.executeFulfillIntentWithCL(model, solver)
      default:
        return this.walletFulfillService.fulfill(model, solver)
    }
  }

  /**
   * Executes the fulfillment of an intent using crowd liquidity.
   *
   * @param {IntentSourceModel} model - The model representing the intent to be fulfilled.
   * @param {Solver} solver - The solver responsible for executing the fulfillment of the intent.
   * @return {Promise<void>} A promise that resolves when the intent fulfillment is successfully executed.
   */
  async executeFulfillIntentWithCL(model: IntentSourceModel, solver: Solver): Promise<Hex> {
    const isRouteSupported = this.crowdLiquidityService.isRouteSupported(model)

    // Track crowd liquidity route support check
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_ROUTE_CHECK, {
      intentHash: model.intent.hash,
      model,
      solver,
      routeSupported: isRouteSupported,
    })

    if (isRouteSupported) {
      try {
        // Track crowd liquidity fulfillment attempt
        this.ecoAnalytics.trackSuccess(
          ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_FULFILLMENT_STARTED,
          {
            intentHash: model.intent.hash,
            model,
            solver,
          },
        )

        const result = await this.crowdLiquidityService.fulfill(model, solver)

        // Track successful crowd liquidity fulfillment
        this.ecoAnalytics.trackSuccess(
          ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_FULFILLMENT_SUCCEEDED,
          {
            intentHash: model.intent.hash,
            model,
            solver,
            transactionHash: result,
          },
        )

        return result
      } catch (error) {
        this.logger.error(
          EcoLogMessage.withError({
            message: 'Failed to fulfill using Crowd Liquidity, proceeding to use solver',
            properties: { intentHash: model.intent.hash },
            error,
          }),
        )

        // Track crowd liquidity fulfillment failure and fallback
        this.ecoAnalytics.trackError(
          ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_FULFILLMENT_FAILED,
          error,
          {
            intentHash: model.intent.hash,
            model,
            solver,
            fallbackToWallet: true,
          },
        )
      }
    }

    // If crowd liquidity is not available for current route, or it failed to fulfill the intent
    // Fulfill the intent using the solver
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.WALLET_FULFILLMENT_FALLBACK, {
      intentHash: model.intent.hash,
      model,
      solver,
      reason: isRouteSupported ? 'crowd_liquidity_failed' : 'route_not_supported',
    })

    return this.walletFulfillService.fulfill(model, solver)
  }
}
