import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { EcoConfigService } from '@libs/solver-config';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
export declare class BalanceHealthIndicator extends HealthIndicator {
    private readonly kernelAccountClientService;
    private readonly configService;
    private logger;
    constructor(kernelAccountClientService: KernelAccountClientService, configService: EcoConfigService);
    checkBalances(): Promise<HealthIndicatorResult>;
    private getAccount;
    private getSources;
    private getSolvers;
    private getBalanceCalls;
    private joinBalance;
    private isTokenHealthy;
}
