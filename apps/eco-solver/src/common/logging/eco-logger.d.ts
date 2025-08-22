import { Logger } from '@nestjs/common';
export declare class EcoLogger extends Logger {
    static logErrorAlways: boolean;
    constructor(context: string, options?: {
        timestamp?: boolean;
    });
    static setLoggingForUnitTests(): void;
    log(message: any, ...optionalParams: [...any, string?]): void;
    info(message: any, ...optionalParams: [...any, string?]): void;
    warn(message: any, ...optionalParams: [...any, string?]): void;
    error(message: any, ...optionalParams: [...any, string?]): void;
    debug(message: any, ...optionalParams: [...any, string?]): void;
}
