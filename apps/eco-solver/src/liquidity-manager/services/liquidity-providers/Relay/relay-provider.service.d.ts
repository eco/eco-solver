import { OnModuleInit } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { KernelAccountClientV2Service } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client-v2.service';
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types';
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider';
export declare class RelayProviderService implements OnModuleInit, IRebalanceProvider<'Relay'> {
    private readonly ecoConfigService;
    private readonly kernelAccountClientService;
    private logger;
    constructor(ecoConfigService: EcoConfigService, kernelAccountClientService: KernelAccountClientV2Service);
    onModuleInit(): Promise<void>;
    getStrategy(): "Relay";
    getQuote(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number): Promise<RebalanceQuote<'Relay'>>;
    execute(walletAddress: string, quote: RebalanceQuote<'Relay'>): Promise<unknown>;
    private getRelayChains;
}
