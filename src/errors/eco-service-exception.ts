import { BadRequestException, HttpException, Logger } from '@nestjs/common';

import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoError } from '@/errors/eco-error';
import { HttpExceptionGenerator } from '@/errors/http-exception-generator';

export interface EcoServiceExceptionParams {
  httpExceptionClass?: new (o: object) => HttpException;
  error: unknown;
  cause?: string;
  additionalData?: Record<string, unknown>;
}

export class EcoServiceException {
  private static httpExceptionGenerator: HttpExceptionGenerator = new HttpExceptionGenerator();

  static getException(
    httpExceptionClass: new (o: object) => HttpException,
    ecoError: unknown,
    cause: string,
    additionalData?: Record<string, unknown>,
  ): HttpException {
    return this.new(httpExceptionClass, ecoError, cause, additionalData);
  }

  static getExceptionForStatus(
    status: number,
    ecoError: unknown,
    cause: string,
    additionalData?: Record<string, unknown>,
  ): HttpException {
    return this.httpExceptionGenerator.createHttpExceptionFromStatus(
      status,
      this.buildPayload(ecoError, cause, additionalData),
    );
  }

  private static new(
    httpExceptionClass: new (o: object) => HttpException,
    ecoError: unknown,
    cause: string,
    additionalData?: Record<string, unknown>,
  ): HttpException {
    return new httpExceptionClass(this.buildPayload(ecoError, cause, additionalData));
  }

  private static buildPayload(
    ecoError: unknown,
    cause: string,
    additionalData?: Record<string, unknown>,
  ) {
    const errorDesc = EcoError.getErrorMessage(ecoError);
    const errorCode =
      typeof ecoError === 'object' && ecoError !== null && 'code' in ecoError
        ? (ecoError as any).code
        : undefined;

    return { errorCode, errorDesc, cause, additionalData };
  }

  static isEcoServiceException(error: any): boolean {
    if (!(error instanceof HttpException)) {
      return false;
    }

    const response = error.getResponse() as any;

    const { errorCode, errorDesc, cause } = response;

    return Boolean(errorCode && errorDesc && cause);
  }
}

function getErrorCause(error: any): string {
  return EcoError.getErrorMessage(error);
}

export function logEcoServiceException(logger: Logger, message: string, error: any) {
  logger.error(
    EcoLogMessage.fromDefault({
      message,
      properties: {
        errorMessage: EcoError.getErrorMessage(error),
      },
    }),
  );
}

export function getEcoServiceErrorReturn(params: EcoServiceExceptionParams): HttpException {
  const { error, cause, additionalData } = params;

  return EcoServiceException.getException(
    BadRequestException,
    error,
    cause || 'unknown',
    additionalData,
  );
}

export function getEcoServiceException(params: EcoServiceExceptionParams): HttpException {
  const { error, additionalData } = params;

  // If it's already an EcoServiceException, don't mess wth it.
  if (EcoServiceException.isEcoServiceException(error)) {
    return error as HttpException;
  }

  const cause = params.cause || getErrorCause(error);

  const rawStatus = (error as any)?.status ?? (error as any)?.statusCode;
  const status = typeof rawStatus === 'number' ? rawStatus : undefined;

  let httpExceptionClass = params.httpExceptionClass;

  if (!httpExceptionClass && status === undefined) {
    httpExceptionClass = BadRequestException;
  }

  if (httpExceptionClass) {
    return EcoServiceException.getException(httpExceptionClass, error, cause, additionalData);
  }

  return EcoServiceException.getExceptionForStatus(status!, error, cause, additionalData);
}
