import { Injectable } from '@nestjs/common';

import { BullMQOtel } from 'bullmq-otel';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { OpenTelemetryConfigService } from '@/modules/config/services';

@Injectable()
export class BullMQOtelFactory {
  private bullMQOtel?: BullMQOtel;

  constructor(
    @InjectPinoLogger(BullMQOtelFactory.name)
    private readonly logger: PinoLogger,
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
      this.logger.info('Creating BullMQOtel instance for telemetry');
      this.bullMQOtel = new BullMQOtel(this.config.serviceName);
    }

    return this.bullMQOtel;
  }
}
