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
import { VmType } from '@eco-foundation/routes-ts'

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
  ) {}

  /**
   * Processes and fulfills a specified intent based on its type.
   *
   * @param {Hex} intentHash - The unique hash identifier of the intent to be fulfilled.
   * @return {Promise<void>} Returns the result of the fulfillment process based on the intent type.
   */
  async fulfill(intentHash: Hex): Promise<unknown> {
    const data = await this.utilsIntentService.getIntentProcessData(intentHash)
    const { model, solver, err } = data ?? {}

    if (err) throw err
    if (!data || !model || !solver) return
    if (model.status === 'SOLVED') return

    const { type } = isNativeIntent({
      source: model.intent.route.source,
      destination: model.intent.route.destination,
      route: {
        ...model.intent.route,
        vm: VmType.EVM,
        deadline: model.intent.reward.deadline,
        portal: model.intent.route.portal,
      },
      reward: model.intent.reward,
    })// disable crowd liquidity for native intents
      ? { type: 'smart-wallet-account' }
      : this.ecoConfigService.getFulfill()

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
    if (this.crowdLiquidityService.isRouteSupported(model)) {
      try {
        return await this.crowdLiquidityService.fulfill(model, solver)
      } catch (error) {
        this.logger.error(
          EcoLogMessage.withError({
            message: 'Failed to fulfill using Crowd Liquidity, proceeding to use solver',
            properties: { intentHash: model.intent.hash },
            error,
          }),
        )
      }
    }

    // If crowd liquidity is not available for current route, or it failed to fulfill the intent
    // Fulfill the intent using the solver
    return this.walletFulfillService.fulfill(model, solver)
  }
}
