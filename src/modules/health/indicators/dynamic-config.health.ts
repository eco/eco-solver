import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { DynamicConfigService } from '@/modules/dynamic-config/services/dynamic-config.service';

@Injectable()
export class DynamicConfigHealthIndicator extends HealthIndicator {
  constructor(private readonly dynamicConfigService: DynamicConfigService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const healthCheck = await this.dynamicConfigService.getDetailedHealthCheck();

      if (healthCheck.healthy) {
        return this.getStatus(key, true, {
          cache: healthCheck.cache ? 'up' : 'down',
          repository: healthCheck.repository ? 'up' : 'down',
          changeStreams: {
            enabled: healthCheck.changeStreams.enabled,
            active: healthCheck.changeStreams.active,
            mode: healthCheck.changeStreams.mode,
          },
          metrics: healthCheck.metrics,
        });
      }

      throw new HealthCheckError(
        'DynamicConfig health check failed',
        this.getStatus(key, false, {
          cache: healthCheck.cache ? 'up' : 'down',
          repository: healthCheck.repository ? 'up' : 'down',
          changeStreams: {
            enabled: healthCheck.changeStreams.enabled,
            active: healthCheck.changeStreams.active,
            mode: healthCheck.changeStreams.mode,
          },
          metrics: healthCheck.metrics,
        }),
      );
    } catch (error) {
      throw new HealthCheckError(
        'DynamicConfig health check failed',
        this.getStatus(key, false, {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
