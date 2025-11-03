import { Injectable } from '@nestjs/common';

import { BullMQOtel } from 'bullmq-otel';

import { OpenTelemetryConfigService } from '@/modules/config/services';
import { Logger } from '@/modules/logging';

@Injectable()
export class BullMQOtelFactory {
  private bullMQOtel?: BullMQOtel;

  constructor(
    private readonly logger: Logger,
    private readonly config: OpenTelemetryConfigService,
  ) {}

  /**
   * Get or create a singleton BullMQOtel instance
   * Returns undefined if OpenTelemetry is disabled
   */
  getInstance(): BullMQOtel | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    if (!this.bullMQOtel) {
      this.logger.info('Creating BullMQOtel instance for telemetry', {
        serviceName: this.config.serviceName,
      });
      this.bullMQOtel = new BullMQOtel(this.config.serviceName);
    }

    return this.bullMQOtel;
  }
}
