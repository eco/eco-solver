import { HttpException, Logger } from '@nestjs/common';
export interface EcoServiceExceptionParams {
    httpExceptionClass?: new (o: object) => HttpException;
    error: any;
    cause?: string;
    additionalData?: object;
}
export declare class EcoServiceException {
    private static httpExceptionGenerator;
    static getException(httpExceptionClass: new (o: object) => HttpException, ecoError: any, cause: any, additionalData?: any): HttpException;
    static getExceptionForStatus(status: number, ecoError: any, cause: any, additionalData?: any): HttpException;
    private static new;
    static isEcoServiceException(error: any): boolean;
}
export declare function logEcoServiceException(logger: Logger, message: string, error: any): void;
export declare function getEcoServiceErrorReturn(params: EcoServiceExceptionParams): HttpException;
export declare function getEcoServiceException(params: EcoServiceExceptionParams): HttpException;
