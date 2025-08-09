import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';

import { Request } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

import { maskSensitiveData } from './winston.config';

@Injectable({ scope: Scope.REQUEST })
export class LoggerService {
  private context: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  setContext(context: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: string, data?: any) {
    const requestId = this.request?.id || 'system';
    const meta = {
      context: this.context,
      requestId,
      ...(data && { data: maskSensitiveData(data) }),
    };

    return { message, ...meta };
  }

  log(message: string, data?: any) {
    this.logger.info(this.formatMessage('info', message, data));
  }

  error(message: string, error?: Error | string, data?: any) {
    const errorData =
      error instanceof Error
        ? {
            error: error.message,
            stack: error.stack,
          }
        : { error };

    this.logger.error(this.formatMessage('error', message, { ...errorData, ...data }));
  }

  warn(message: string, data?: any) {
    this.logger.warn(this.formatMessage('warn', message, data));
  }

  debug(message: string, data?: any) {
    this.logger.debug(this.formatMessage('debug', message, data));
  }

  verbose(message: string, data?: any) {
    this.logger.verbose(this.formatMessage('verbose', message, data));
  }
}

@Injectable()
export class SystemLoggerService {
  private context: string;

  constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger) {}

  setContext(context: string) {
    this.context = context;
  }

  private formatMessage(level: string, message: string, data?: any) {
    const meta = {
      context: this.context,
      requestId: 'system',
      ...(data && { data: maskSensitiveData(data) }),
    };

    return { message, ...meta };
  }

  log(message: string, data?: any) {
    this.logger.info(this.formatMessage('info', message, data));
  }

  error(message: string, error?: Error | string, data?: any) {
    const errorData =
      error instanceof Error
        ? {
            error: error.message,
            stack: error.stack,
          }
        : { error };

    this.logger.error(this.formatMessage('error', message, { ...errorData, ...data }));
  }

  warn(message: string, data?: any) {
    this.logger.warn(this.formatMessage('warn', message, data));
  }

  debug(message: string, data?: any) {
    this.logger.debug(this.formatMessage('debug', message, data));
  }

  verbose(message: string, data?: any) {
    this.logger.verbose(this.formatMessage('verbose', message, data));
  }
}
