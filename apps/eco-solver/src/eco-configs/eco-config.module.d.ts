import { DynamicModule, Provider } from '@nestjs/common';
export declare class EcoConfigModule {
    static withAWS(): DynamicModule;
    static base(): DynamicModule;
    static createAwsProvider(): Provider;
    static createBaseProvider(): Provider;
}
