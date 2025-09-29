import { Injectable } from '@nestjs/common';

import { BullMQOtel } from 'bullmq-otel';

import { OpenTelemetryConfigService } from '@/modules/config/services';
import { SystemLoggerService } from '@/modules/logging/logger.service';

@Injectable()
export class BullMQOtelFactory {
  private bullMQOtel?: BullMQOtel;

  constructor(
    private readonly config: OpenTelemetryConfigService,
    private readonly logger: SystemLoggerService,
  ) {
    this.logger.setContext(BullMQOtelFactory.name);
  }

  /**
   * Get or create a singleton BullMQOtel instance
   * Returns undefined if OpenTelemetry is disabled
   */
  getInstance(): BullMQOtel | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    if (!this.bullMQOtel) {
      this.logger.log('Creating BullMQOtel instance for telemetry');
      this.bullMQOtel = new BullMQOtel(this.config.serviceName);
    }

    return this.bullMQOtel;
  }
}
