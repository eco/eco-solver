import { BadRequestException, HttpException, Logger } from '@nestjs/common'
import { EcoError } from '@eco-solver/common/errors/eco-error'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { HttpExceptionGenerator } from '@eco-solver/common/errors/http-exception-generator'

export interface EcoServiceExceptionParams {
  httpExceptionClass?: new (o: object) => HttpException
  error: any
  cause?: string
  additionalData?: object
}

export class EcoServiceException {
  private static httpExceptionGenerator: HttpExceptionGenerator = new HttpExceptionGenerator()

  static getException(
    httpExceptionClass: new (o: object) => HttpException,
    ecoError: any,
    cause: any,
    additionalData?: any,
  ): HttpException {
    return this.new(httpExceptionClass, ecoError, cause, additionalData)
  }

  static getExceptionForStatus(
    status: number,
    ecoError: any,
    cause: any,
    additionalData?: any,
  ): HttpException {
    return this.httpExceptionGenerator.createHttpExceptionFromStatus(status, {
      errorCode: ecoError.code,
      errorDesc: ecoError.message,
      cause,
      additionalData,
    })
  }

  private static new(
    httpExceptionClass: new (o: object) => HttpException,
    ecoError: any,
    cause: any,
    additionalData?: any,
  ): HttpException {
    return new httpExceptionClass({
      errorCode: ecoError.code,
      errorDesc: ecoError.message,
      cause,
      additionalData,
    })
  }

  static isEcoServiceException(error: any): boolean {
    if (!(error instanceof HttpException)) {
      return false
    }

    const response = error.getResponse() as any

    const { errorCode, errorDesc, cause } = response

    return Boolean(errorCode && errorDesc && cause)
  }
}

function getErrorCause(error: any): string {
  return EcoError.getErrorMessage(error)
}

export function logEcoServiceException(logger: Logger, message: string, error: any) {
  logger.error(
    EcoLogMessage.fromDefault({
      message,
      properties: {
        errorMessage: EcoError.getErrorMessage(error),
      },
    }),
  )
}

export function getEcoServiceErrorReturn(params: EcoServiceExceptionParams): HttpException {
  const { error, cause, additionalData } = params

  return EcoServiceException.getException(BadRequestException, error, cause, additionalData)
}

export function getEcoServiceException(params: EcoServiceExceptionParams): HttpException {
  const { error, additionalData } = params

  // If it's already an EcoServiceException, don't mess wth it.
  if (EcoServiceException.isEcoServiceException(error)) {
    return error
  }

  const cause = params.cause || getErrorCause(error)
  const status = error.status || error.statusCode
  let httpExceptionClass = params.httpExceptionClass

  if (!httpExceptionClass && !status) {
    httpExceptionClass = BadRequestException
  }

  if (httpExceptionClass) {
    return EcoServiceException.getException(httpExceptionClass, error, cause, additionalData)
  }

  return EcoServiceException.getExceptionForStatus(status, error, cause, additionalData)
}
