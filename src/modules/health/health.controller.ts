import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private healthService: HealthService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.healthService.check();
  }

  @Get('live')
  @HealthCheck()
  liveness() {
    return this.healthService.liveness();
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.healthService.readiness();
  }
}
