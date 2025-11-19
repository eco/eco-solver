import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

// Define a type for constructors of HttpException subclasses that accept a response body
type HttpExceptionConstructor = new (response: string | Record<string, unknown>) => HttpException;

const exceptionMap = new Map<number, HttpExceptionConstructor>([
  [HttpStatus.BAD_REQUEST, BadRequestException],
  [HttpStatus.UNAUTHORIZED, UnauthorizedException],
  [HttpStatus.FORBIDDEN, ForbiddenException],
  [HttpStatus.NOT_FOUND, NotFoundException],
  [HttpStatus.CONFLICT, ConflictException],
  [HttpStatus.INTERNAL_SERVER_ERROR, InternalServerErrorException],
]);

export class HttpExceptionGenerator {
  createHttpExceptionFromStatus(
    status: number,
    response: string | Record<string, unknown>,
  ): HttpException {
    const ExceptionClass = exceptionMap.get(status);

    if (ExceptionClass) {
      // Known status: use the specific subclass and let it control the HTTP status code
      return new ExceptionClass(response);
    }

    // Fallback: use the base HttpException with the explicit status
    return new HttpException(response, status);
  }
}
