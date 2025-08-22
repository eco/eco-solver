import { EcoConfigService } from '@libs/solver-config';
import { BalanceService } from '@eco-solver/balance/balance.service';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { ClientCommand } from '@eco-solver/commander/transfer/client.command';
export declare class BalanceCommand extends ClientCommand {
    protected readonly balanceService: BalanceService;
    protected readonly kernelAccountClientService: KernelAccountClientService;
    protected readonly ecoConfigService: EcoConfigService;
    constructor(balanceService: BalanceService, kernelAccountClientService: KernelAccountClientService, ecoConfigService: EcoConfigService);
    run(passedParams: string[], options?: Record<string, any>): Promise<void>;
    getWalletAddress(): Promise<`0x${string}`>;
    parseChainID(val: string): number;
    parseToken(val: string): `0x${string}`;
}
