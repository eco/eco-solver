import { OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { LiquidityManagerQueueType } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider';
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types';
import { EcoConfigService } from '@libs/solver-config';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { Hex } from 'viem';
export declare class EverclearProviderService implements IRebalanceProvider<'Everclear'>, OnModuleInit {
    private cacheManager;
    private readonly configService;
    private readonly kernelAccountClientService;
    private readonly queue;
    private logger;
    private config;
    private readonly liquidityManagerQueue;
    constructor(cacheManager: Cache, configService: EcoConfigService, kernelAccountClientService: KernelAccountClientService, queue: LiquidityManagerQueueType);
    onModuleInit(): Promise<void>;
    getStrategy(): "Everclear";
    private getTokenSymbol;
    getQuote(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number, id?: string): Promise<RebalanceQuote<'Everclear'>[]>;
    execute(walletAddress: string, quote: RebalanceQuote<'Everclear'>): Promise<string>;
    checkIntentStatus(txHash: Hex): Promise<{
        status: 'pending' | 'complete' | 'failed';
        intentId?: string;
    }>;
}
