import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { Hex } from 'viem'
import { UtilsIntentService } from './utils-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { WalletFulfillService } from '@/intent/wallet-fulfill.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { isNativeIntent } from './utils'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS, ERROR_EVENTS } from '@/analytics/events.constants'
import { QUEUES } from '@/common/redis/constants'
import { getIntentJobId } from '@/common/utils/strings'

/**
 * This class fulfills an intent by creating the transactions for the intent targets and the fulfill intent transaction.
 */
@Injectable()
export class FulfillIntentService {
  private logger = new Logger(FulfillIntentService.name)

  constructor(
    @InjectQueue(QUEUES.SOURCE_INTENT.queue) private readonly intentQueue: Queue,
    private readonly utilsIntentService: UtilsIntentService,
    private readonly ecoConfigService: EcoConfigService,
    private readonly walletFulfillService: WalletFulfillService,
    private readonly crowdLiquidityService: CrowdLiquidityService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  /**
   * Processes and fulfills a specified intent based on its type.
   * This method decides which fulfillment strategy to use and creates the appropriate job.
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

    // Track fulfillment method selection
    this.ecoAnalytics.trackIntentFulfillmentMethodSelected(
      intentHash,
      type || 'smart-wallet-account',
      isNative,
      model,
      solver,
    )

    // Create the appropriate job based on fulfillment type
    if (type === 'crowd-liquidity' && !isNative) {
      // Check if crowd liquidity route is supported
      const isRouteSupported = this.crowdLiquidityService.isRouteSupported(model)

      // Track crowd liquidity route support check
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_ROUTE_CHECK, {
        intentHash: model.intent.hash,
        model,
        solver,
        routeSupported: isRouteSupported,
      })

      if (isRouteSupported) {
        // Create crowd liquidity job
        const jobId = getIntentJobId('crowd-liquidity', intentHash, model.intent.logIndex)
        const crowdLiquidityJobConfig =
          this.ecoConfigService.getRedis().jobs.crowdLiquidityJobConfig

        this.logger.debug(
          `Creating crowd liquidity fulfillment job for ${intentHash} with jobId ${jobId}`,
        )

        await this.intentQueue.add(
          QUEUES.SOURCE_INTENT.jobs.fulfill_intent_crowd_liquidity,
          intentHash,
          {
            jobId,
            ...crowdLiquidityJobConfig,
          },
        )

        return
      } else {
        // Route not supported, fall back to wallet fulfillment
        this.logger.debug(
          `Crowd liquidity route not supported for ${intentHash}, falling back to wallet fulfillment`,
        )

        this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.WALLET_FULFILLMENT_FALLBACK, {
          intentHash,
          model,
          solver,
          reason: 'route_not_supported',
        })
      }
    }

    // Create wallet fulfillment job (either as primary choice or fallback)
    await this.addWalletFulfillmentJob(intentHash, model.intent.logIndex)
  }

  /**
   * Fulfills an intent using crowd liquidity only.
   * This method is called directly from the crowd liquidity job.
   *
   * @param {Hex} intentHash - The unique hash identifier of the intent to be fulfilled.
   * @return {Promise<Hex>} Returns the transaction hash of the fulfillment.
   */
  async fulfillWithCrowdLiquidity(intentHash: Hex): Promise<Hex> {
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
        method: 'crowd_liquidity',
      })
      throw err
    }

    if (!data || !model || !solver) {
      // Track fulfillment failed due to missing data
      const error = new Error('missing_model_or_solver')
      this.ecoAnalytics.trackError(ERROR_EVENTS.INTENT_FULFILLMENT_FAILED, error, {
        intentHash,
        data,
        model,
        solver,
        reason: 'missing_model_or_solver',
        stage: 'data_retrieval',
        method: 'crowd_liquidity',
      })
      throw error
    }

    if (model.status === 'SOLVED') {
      // Track already solved intent
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FULFILLMENT_SKIPPED, {
        intentHash,
        model,
        solver,
        reason: 'already_solved',
        method: 'crowd_liquidity',
      })
      return '0x0' as Hex
    }

    // Track crowd liquidity fulfillment attempt
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_FULFILLMENT_STARTED, {
      intentHash: model.intent.hash,
      model,
      solver,
    })

    const result = await this.crowdLiquidityService.fulfill(model)

    // Track successful crowd liquidity fulfillment
    this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.CROWD_LIQUIDITY_FULFILLMENT_SUCCEEDED, {
      intentHash: model.intent.hash,
      model,
      solver,
      transactionHash: result,
    })

    return result
  }

  /**
   * Creates a wallet fulfillment job for the given intent.
   * This method centralizes the logic for adding wallet fulfillment jobs to the queue.
   *
   * @param {Hex} intentHash - The unique hash identifier of the intent
   * @param {number} logIndex - The log index of the intent
   * @return {Promise<void>}
   */
  async addWalletFulfillmentJob(intentHash: Hex, logIndex: number): Promise<void> {
    const jobId = getIntentJobId('wallet-fulfill', intentHash, logIndex)
    const walletFulfillJobConfig = this.ecoConfigService.getRedis().jobs.walletFulfillJobConfig

    this.logger.debug(`Creating wallet fulfillment job for ${intentHash} with jobId ${jobId}`)

    await this.intentQueue.add(QUEUES.SOURCE_INTENT.jobs.fulfill_intent_wallet, intentHash, {
      jobId,
      ...walletFulfillJobConfig,
    })
  }

  /**
   * Fulfills an intent using wallet fulfillment only.
   * This method is called directly from the wallet fulfill job.
   *
   * @param {Hex} intentHash - The unique hash identifier of the intent to be fulfilled.
   * @return {Promise<Hex>} Returns the transaction hash of the fulfillment.
   */
  async fulfillWithWallet(intentHash: Hex): Promise<Hex> {
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
        method: 'wallet',
      })
      throw err
    }

    if (!data || !model || !solver) {
      // Track fulfillment failed due to missing data
      const error = new Error('missing_model_or_solver')
      this.ecoAnalytics.trackError(ERROR_EVENTS.INTENT_FULFILLMENT_FAILED, error, {
        intentHash,
        data,
        model,
        solver,
        reason: 'missing_model_or_solver',
        stage: 'data_retrieval',
        method: 'wallet',
      })
      throw error
    }

    if (model.status === 'SOLVED') {
      // Track already solved intent
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.INTENT.FULFILLMENT_SKIPPED, {
        intentHash,
        model,
        solver,
        reason: 'already_solved',
        method: 'wallet',
      })
      return '0x0' as Hex
    }

    // Track wallet fulfillment method selected
    this.ecoAnalytics.trackIntentFulfillmentMethodSelected(
      intentHash,
      'smart-wallet-account',
      false,
      model,
      solver,
    )

    return this.walletFulfillService.fulfill(model, solver)
  }
}
