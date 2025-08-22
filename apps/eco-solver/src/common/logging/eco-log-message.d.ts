import { EcoError } from '../errors/eco-error';
interface BaseLoggingDataParams {
    message: string;
    properties?: object;
}
interface LoggingDataParamsWithUser extends BaseLoggingDataParams {
    userID: string;
}
interface LoggingDataParamsWithError extends BaseLoggingDataParams {
    error: EcoError;
}
interface LoggingDataParamsWithErrorAndUser extends LoggingDataParamsWithError {
    userID: string;
}
interface LoggingDataParamsWithErrorAndId extends LoggingDataParamsWithError {
    id?: string;
}
interface LoggingDataParamsWithId extends BaseLoggingDataParams {
    id?: string;
}
export declare class EcoLogMessage {
    private readonly _content;
    private constructor();
    get content(): object;
    static fromDefault(params: BaseLoggingDataParams): object;
    static withUser(params: LoggingDataParamsWithUser): object;
    static withError(params: LoggingDataParamsWithError): object;
    static withErrorAndUser(params: LoggingDataParamsWithErrorAndUser): object;
    static withId(params: LoggingDataParamsWithId): object;
    static withErrorAndId(params: LoggingDataParamsWithErrorAndId): object;
}
export {};
