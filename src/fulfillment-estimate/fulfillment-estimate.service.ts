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
      this.logger.error('executionPaddingSeconds not found in fulfillmentEstimateConfig', {
        service: 'fulfillment-estimate-service',
        operation: 'module_init',
        config_field: 'executionPaddingSeconds',
      })
      throw new Error('executionPaddingSeconds not found in fulfillmentEstimateConfig')
    }

    if (this.fulfillmentConfig.blockTimePercentile == null) {
      this.logger.error('blockTimePercentile not found in fulfillmentEstimateConfig', {
        service: 'fulfillment-estimate-service',
        operation: 'module_init',
        config_field: 'blockTimePercentile',
      })
      throw new Error('blockTimePercentile not found in fulfillmentEstimateConfig')
    }

    if (this.fulfillmentConfig.defaultBlockTime == null) {
      this.logger.error('defaultBlockTime not found in fulfillmentEstimateConfig', {
        service: 'fulfillment-estimate-service',
        operation: 'module_init',
        config_field: 'defaultBlockTime',
      })
      throw new Error('defaultBlockTime not found in fulfillmentEstimateConfig')
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
      this.logger.warn('solver.averageBlockTime is undefined, using default block time', {
        service: 'fulfillment-estimate-service',
        operation: 'get_average_block_time',
        fallback_value: this.fulfillmentConfig.defaultBlockTime,
      })
      return this.fulfillmentConfig.defaultBlockTime
    }

    return solver.averageBlockTime
  }
}
