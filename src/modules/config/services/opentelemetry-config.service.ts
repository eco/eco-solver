import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Config, OpenTelemetrySchema } from '@/config/config.schema';

/**
 * OpenTelemetry configuration service
 * Provides typed access to OpenTelemetry configuration values
 */
@Injectable()
export class OpenTelemetryConfigService {
  constructor(private configService: ConfigService<Config>) {}

  /**
   * Get the OpenTelemetry configuration section
   */
  private get config() {
    const config = this.configService.get('opentelemetry', { infer: true });
    return OpenTelemetrySchema.parse(config);
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  get serviceName(): string {
    return this.config.serviceName;
  }

  get otlp() {
    return this.config.otlp;
  }

  get resource() {
    return this.config.resource;
  }

  get instrumentation() {
    return this.config.instrumentation;
  }

  get sampling() {
    return this.config.sampling;
  }
}
