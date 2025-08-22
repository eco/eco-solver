import { DynamicModule, Provider } from '@nestjs/common';
import { NestRedlockConfig, NestRedlockDynamicConfig } from './nest-redlock.config';
export declare class RedlockModule {
    static forRoot(config: NestRedlockConfig): DynamicModule;
    static forRootAsync(dynamicConfig: NestRedlockDynamicConfig): DynamicModule;
    static createAsyncProviders(dynamicConfig: NestRedlockDynamicConfig): Provider[];
}
