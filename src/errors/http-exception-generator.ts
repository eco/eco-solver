import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

// Define a type for constructors of classes that extend HttpException
type HttpExceptionConstructor = new (...args: any[]) => HttpException;

const exceptionMap = new Map<number, HttpExceptionConstructor>([
  [400, BadRequestException],
  [401, UnauthorizedException],
  [403, ForbiddenException],
  [404, NotFoundException],
  [409, ConflictException],
  [500, InternalServerErrorException],
]);

export class HttpExceptionGenerator {
  createHttpExceptionFromStatus(status: number, ...args: any[]): HttpException {
    const ExceptionClass = exceptionMap.get(status) || HttpException;
    return new (ExceptionClass as any)(...args, status);
  }
}
