import { Controller, Get, Logger } from '@nestjs/common'
import { HealthCheck } from '@nestjs/terminus'
import { API_ROOT } from '@libs/shared'
import { HealthService } from './health.service'
import { EcoAnalyticsService } from '@libs/integrations'
import { EcoLogMessage } from '@libs/shared'
import { ANALYTICS_EVENTS } from '@libs/integrations'

const HealthPath = '/health'

@Controller(API_ROOT)
export class HealthController {
  private logger = new Logger(HealthController.name)
  constructor(
    private healthService: HealthService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  @Get(HealthPath)
  @HealthCheck()
  async check() {
    const startTime = Date.now()

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `HealthController`,
      }),
    )

    this.ecoAnalytics.trackHealthRequestReceived(ANALYTICS_EVENTS.HEALTH.CHECK_REQUEST, {})

    try {
      const result = await this.healthService.checkHealth()

      this.ecoAnalytics.trackHealthResponseSuccess(ANALYTICS_EVENTS.HEALTH.CHECK_SUCCESS, {
        result,
        processingTimeMs: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.ecoAnalytics.trackHealthResponseError(ANALYTICS_EVENTS.HEALTH.CHECK_ERROR, error, {
        processingTimeMs: Date.now() - startTime,
      })
      throw error
    }
  }
}
