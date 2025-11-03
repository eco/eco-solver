import { Injectable, OnModuleInit } from '@nestjs/common';

import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';

import { AppConfigService } from '@/modules/config/services/app-config.service';
import { OpenTelemetryConfigService } from '@/modules/config/services/opentelemetry-config.service';

/**
 * Bridge service that exports Pino logs to OpenTelemetry collector via OTLP
 *
 * This service:
 * - Initializes OpenTelemetry LoggerProvider
 * - Configures OTLP log exporter
 * - Maps Pino log levels to OpenTelemetry severity levels
 * - Provides methods for exporting logs programmatically
 */
@Injectable()
export class PinoOtelBridgeService implements OnModuleInit {
  private loggerProvider: LoggerProvider | null = null;
  private otelLogger: any = null;

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly otelConfigService: OpenTelemetryConfigService,
  ) {}

  async onModuleInit() {
    const loggerConfig = this.appConfigService.getLoggerConfig();

    // Only initialize if OTLP log export is enabled
    const enabled = loggerConfig.otelLogExport?.enabled ?? this.otelConfigService.enabled;
    if (!enabled) {
      return;
    }

    // Determine endpoint - use logger-specific if provided, otherwise use OpenTelemetry OTLP endpoint
    const endpoint = loggerConfig.otelLogExport?.endpoint || this.otelConfigService.otlp.endpoint;
    const logsEndpoint = endpoint.endsWith('/v1/logs') ? endpoint : `${endpoint}/v1/logs`;

    // Create OTLP log exporter
    const logExporter = new OTLPLogExporter({
      url: logsEndpoint,
      headers: {
        ...this.otelConfigService.otlp.headers,
        ...loggerConfig.otelLogExport?.headers,
      },
    });

    // Use BatchLogRecordProcessor for production, SimpleLogRecordProcessor for development
    const processor =
      process.env.NODE_ENV === 'production'
        ? new BatchLogRecordProcessor(logExporter)
        : new SimpleLogRecordProcessor(logExporter);

    // Create logger provider with processor
    this.loggerProvider = new LoggerProvider({
      processors: [processor],
    });

    // Register global logger provider
    logs.setGlobalLoggerProvider(this.loggerProvider);

    // Get logger instance
    this.otelLogger = this.loggerProvider.getLogger(this.otelConfigService.serviceName, '1.0.0');
  }

  /**
   * Map Pino log level to OpenTelemetry severity number
   */
  private mapPinoLevelToSeverity(level: number | string): SeverityNumber {
    // Pino levels: trace=10, debug=20, info=30, warn=40, error=50, fatal=60
    const numLevel = typeof level === 'number' ? level : this.pinoLevelToNumber(level);

    if (numLevel >= 60) return SeverityNumber.FATAL;
    if (numLevel >= 50) return SeverityNumber.ERROR;
    if (numLevel >= 40) return SeverityNumber.WARN;
    if (numLevel >= 30) return SeverityNumber.INFO;
    if (numLevel >= 20) return SeverityNumber.DEBUG;
    return SeverityNumber.TRACE;
  }

  /**
   * Convert Pino level string to number
   */
  private pinoLevelToNumber(level: string): number {
    const levelMap: Record<string, number> = {
      trace: 10,
      debug: 20,
      info: 30,
      warn: 40,
      error: 50,
      fatal: 60,
    };
    return levelMap[level.toLowerCase()] || 30;
  }

  /**
   * Export a log record to OpenTelemetry
   * This method can be called directly to send logs to OTLP
   */
  exportLog(logRecord: {
    level: number | string;
    message: string;
    timestamp?: Date;
    attributes?: Record<string, any>;
  }): void {
    if (!this.otelLogger) {
      return; // OTLP export not enabled
    }

    const severity = this.mapPinoLevelToSeverity(logRecord.level);

    this.otelLogger.emit({
      severityNumber: severity,
      severityText: typeof logRecord.level === 'string' ? logRecord.level : undefined,
      body: logRecord.message,
      timestamp: logRecord.timestamp || new Date(),
      attributes: logRecord.attributes || {},
    });
  }

  /**
   * Shutdown the logger provider and flush all pending logs
   */
  async shutdown(): Promise<void> {
    if (this.loggerProvider) {
      await this.loggerProvider.shutdown();
    }
  }

  /**
   * Get the logger provider instance (for advanced use cases)
   */
  getLoggerProvider(): LoggerProvider | null {
    return this.loggerProvider;
  }

  /**
   * Check if OTLP log export is enabled
   */
  isEnabled(): boolean {
    return this.loggerProvider !== null;
  }
}
