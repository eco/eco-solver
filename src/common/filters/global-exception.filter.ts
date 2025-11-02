import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  errors?: any[]; // Validation errors from ZodValidationPipe
  timestamp: string;
  path: string;
  requestId?: string;
  details?: any;
  [key: string]: any; // Index signature for dynamic properties
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GlobalExceptionFilter.name)
    private readonly logger: PinoLogger,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const requestId = request.headers['x-request-id'] || request.id;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error: string | undefined;
    let errors: any[] | undefined;
    let details: any;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();

      // Check if this is a BadRequestException with validation structure
      if (
        exception instanceof BadRequestException &&
        typeof response === 'object' &&
        response !== null
      ) {
        // Return the validation response directly for quotes API
        httpAdapter.reply(ctx.getResponse(), response, statusCode);
        return;
      }

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        message = (response as any).message || message;
        error = (response as any).error;
        errors = (response as any).errors; // Extract validation errors
        details = (response as any).details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;

      // Log full error details for non-HTTP exceptions
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack, {
        requestId,
        path: request.url,
        method: request.method,
      });
    } else {
      // Log unknown exception types
      this.logger.error('Unknown exception type', exception, {
        requestId,
        path: request.url,
        method: request.method,
      });
    }

    const errorResponse: ErrorResponse = {
      statusCode,
      message,
      error,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      details,
    };

    // Remove undefined fields
    Object.keys(errorResponse).forEach(
      (key) => errorResponse[key] === undefined && delete errorResponse[key],
    );

    httpAdapter.reply(ctx.getResponse(), errorResponse, statusCode);
  }
}
