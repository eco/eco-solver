import { EcoConfigService } from '@libs/solver-config';
export declare class ClassWithConfig {
    private readonly config;
    private classConfig;
    constructor(config: EcoConfigService);
    gimmeConfig(): any;
}
