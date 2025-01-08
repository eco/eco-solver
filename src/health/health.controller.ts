import { Controller, Get, Logger } from '@nestjs/common'
import { HealthCheck } from '@nestjs/terminus'
import { HealthPath } from './constants'
import { HealthService } from './health.service'
import { API_ROOT } from '../common/routes/constants'
import { EcoLogMessage } from '../common/logging/eco-log-message'

@Controller(API_ROOT)
export class HealthController {
  private logger = new Logger(HealthController.name)
  constructor(private healthService: HealthService) {}

  @Get(HealthPath)
  @HealthCheck()
  check() {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `HealthController`,
      }),
    )
    return this.healthService.checkHealth()
  }
}
