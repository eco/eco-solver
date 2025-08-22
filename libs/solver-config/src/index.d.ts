export * from './lib/solver-config';
export * from './lib/schemas/eco-solver.schema';
export * from './lib/interfaces/config-source.interface';
export * from './lib/services/eco-solver-config.service';
export * from './lib/modules/eco-solver-config.module';
export * from './lib/providers/static-config.provider';
export * from './lib/providers/aws-secrets.provider';
export * from './lib/providers/env-override.provider';
export * from './lib/utils/chain-config.utils';
export { EcoSolverConfigService as EcoConfigService } from './lib/services/eco-solver-config.service';
export { EcoSolverConfigModule as EcoConfigModule } from './lib/modules/eco-solver-config.module';
export declare class ConfigLoader {
    static getInstance(options?: any): {
        load: () => any;
    };
    static load(options?: any): any;
}
