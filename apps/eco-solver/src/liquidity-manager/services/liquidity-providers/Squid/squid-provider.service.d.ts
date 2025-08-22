import { OnModuleInit } from '@nestjs/common';
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider';
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types';
import { EcoConfigService } from '@libs/solver-config';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
export declare class SquidProviderService implements OnModuleInit, IRebalanceProvider<'Squid'> {
    private readonly ecoConfigService;
    private readonly kernelAccountClientService;
    private logger;
    private squid;
    constructor(ecoConfigService: EcoConfigService, kernelAccountClientService: KernelAccountClientService);
    onModuleInit(): Promise<void>;
    getStrategy(): "Squid";
    getQuote(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number, id?: string): Promise<RebalanceQuote<'Squid'>[]>;
    execute(walletAddress: string, quote: RebalanceQuote<'Squid'>): Promise<string>;
}
