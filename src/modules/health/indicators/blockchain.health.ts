import { Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { getErrorMessage } from '@/common/utils/error-handler';

@Injectable()
export class BlockchainHealthIndicator extends HealthIndicator {
  constructor() {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    // For now, we'll do a simple health check
    // In production, this would check RPC connectivity
    try {
      // Simple check that blockchain module is loaded
      return this.getStatus(key, true, {
        message: 'Blockchain module loaded',
        note: 'RPC health checks would be implemented here',
      });
    } catch (error) {
      throw new HealthCheckError(
        'Blockchain health check failed',
        this.getStatus(key, false, { message: getErrorMessage(error) }),
      );
    }
  }
}
