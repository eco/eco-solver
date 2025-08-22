import { HttpException } from '@nestjs/common';
export declare class HttpExceptionGenerator {
    createHttpExceptionFromStatus(status: number, ...args: any[]): HttpException;
}
