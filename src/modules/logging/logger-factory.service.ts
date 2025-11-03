import { Injectable } from '@nestjs/common';

import { Params } from 'nestjs-pino';

import { AppConfigService } from '@/modules/config/services';

import { Logger } from './logger.service';

/**
 * Factory service for creating Logger instances with consistent configuration
 *
 * This service provides properly configured Logger instances that use the
 * application's logger configuration from LoggerSchema, ensuring all loggers
 * have the same settings for log levels, redaction, and serialization.
 *
 * Usage:
 * ```typescript
 * constructor(private readonly loggerFactory: LoggerFactory) {}
 *
 * const logger = this.loggerFactory.createLogger('MyContext');
 * logger.info('Message', { data: 'value' });
 * ```
 */
@Injectable()
export class LoggerFactory {
  private readonly params: Params;

  constructor(private readonly appConfigService: AppConfigService) {
    const loggerConfig = this.appConfigService.getLoggerConfig();
    this.params = {
      pinoHttp: loggerConfig.pinoConfig.pinoHttp,
    };
  }

  /**
   * Create a new Logger instance with application configuration
   * @param context - Optional context name for the logger (e.g., class name)
   * @returns Configured Logger instance
   */
  createLogger(context?: string): Logger {
    const logger = new Logger(this.params);
    if (context) {
      logger.setContext(context);
    }
    return logger;
  }

  /**
   * Get the Params configuration used by this factory
   * Useful for testing or creating loggers with custom modifications
   */
  getParams(): Params {
    return this.params;
  }
}
