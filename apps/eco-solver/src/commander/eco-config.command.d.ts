import { EcoConfigService } from '@libs/solver-config';
import { CommandRunner } from 'nest-commander';
export declare class EcoConfigCommand extends CommandRunner {
    private readonly configService;
    constructor(configService: EcoConfigService);
    run(passedParams: string[], options?: Record<string, any>): Promise<void>;
}
