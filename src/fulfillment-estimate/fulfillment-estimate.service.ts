import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { FulfillmentEstimateConfig } from '@/eco-configs/eco-config.types'
import { Solver } from '@/eco-configs/eco-config.types'
import { QuoteIntentDataInterface } from '@/quote/dto/quote.intent.data.dto'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'

/**
 * Service for estimating fulfillment times for intents
 */
@Injectable()
export class FulfillmentEstimateService implements OnModuleInit {
  private logger = new Logger(FulfillmentEstimateService.name)
  private fulfillmentConfig: FulfillmentEstimateConfig

  constructor(private readonly ecoConfigService: EcoConfigService) {}

  onModuleInit() {
    this.fulfillmentConfig = this.ecoConfigService.getFulfillmentEstimateConfig()

    if (this.fulfillmentConfig.executionPaddingSeconds == null) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'executionPaddingSeconds not found in intentConfigs',
        }),
      )
      throw new Error('executionPaddingSeconds not found in intentConfigs')
    }

    if (this.fulfillmentConfig.blockTimePercentile == null) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'blockTimePercentile not found in intentConfigs',
        }),
      )
      throw new Error('blockTimePercentile not found in intentConfigs')
    }

    if (this.fulfillmentConfig.defaultBlockTime == null) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'defaultBlockTime not found in intentConfigs',
        }),
      )
      throw new Error('defaultBlockTime not found in intentConfigs')
    }
  }

  /**
   * Returns the estimated fulfillment time in seconds
   * @param quoteIntentModel the quote intent model
   * @returns the estimated fulfillment time in seconds
   */
  getEstimatedFulfillTime(quoteIntentModel: QuoteIntentDataInterface): number {
    const solver = this.ecoConfigService.getSolver(quoteIntentModel.route.destination)

    const averageBlockTime = this.getAverageBlockTime(solver)
    const blockTimePercentile = this.fulfillmentConfig.blockTimePercentile
    const executionPaddingSeconds = this.fulfillmentConfig.executionPaddingSeconds

    return averageBlockTime * blockTimePercentile + executionPaddingSeconds
  }

  /**
   * Returns the average block time for the given solver. Falls back to defaultBlockTime if
   * averageBlockTime is not defined in the solver.
   * @param solver The solver to get the average block time for
   * @returns The average block time in seconds
   */
  getAverageBlockTime(solver: Solver | undefined): number {
    if (solver?.averageBlockTime == null) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: 'solver.averageBlockTime is undefined, using default block time',
        }),
      )
      return this.fulfillmentConfig.defaultBlockTime
    }

    return solver.averageBlockTime
  }
}
