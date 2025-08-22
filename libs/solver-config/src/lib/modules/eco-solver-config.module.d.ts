import { DynamicModule, Provider } from '@nestjs/common';
export interface EcoSolverConfigOptions {
    enableAws?: boolean;
    enableEnvOverrides?: boolean;
    awsRegion?: string;
    customProviders?: Provider[];
}
export declare class EcoSolverConfigModule {
    static forRoot(options?: EcoSolverConfigOptions): DynamicModule;
    static withAWS(region?: string): DynamicModule;
    static withFullFeatures(): DynamicModule;
    static base(): DynamicModule;
}
