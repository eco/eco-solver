import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';

import { ApiZodResponse } from '@/common/decorators/zod-schema.decorator';

import {
  HealthErrorResponseSchema,
  HealthSuccessResponseSchema,
  LivenessResponseSchema,
} from './schemas/health-response.schema';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private healthService: HealthService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'General health check',
    description:
      'Returns the overall health status of the application including all dependencies (MongoDB, Redis, Blockchain connections)',
  })
  @ApiZodResponse(HttpStatus.OK, HealthSuccessResponseSchema, 'Service is healthy')
  @ApiZodResponse(HttpStatus.SERVICE_UNAVAILABLE, HealthErrorResponseSchema, 'Service is unhealthy')
  check() {
    return this.healthService.check();
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({
    summary: 'Kubernetes liveness probe',
    description: 'Simple liveness check that always returns OK if the service is running',
  })
  @ApiZodResponse(HttpStatus.OK, LivenessResponseSchema, 'Service is alive')
  liveness() {
    return this.healthService.liveness();
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Kubernetes readiness probe',
    description:
      'Checks if the service is ready to handle traffic by verifying all critical dependencies',
  })
  @ApiZodResponse(HttpStatus.OK, HealthSuccessResponseSchema, 'Service is ready')
  @ApiZodResponse(HttpStatus.SERVICE_UNAVAILABLE, HealthErrorResponseSchema, 'Service is not ready')
  readiness() {
    return this.healthService.readiness();
  }
}
