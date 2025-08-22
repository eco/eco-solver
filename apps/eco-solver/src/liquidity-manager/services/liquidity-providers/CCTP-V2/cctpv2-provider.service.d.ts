import { Hex } from 'viem';
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider';
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types';
import { EcoConfigService } from '@libs/solver-config';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { LiquidityManagerQueueType } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { WalletClientDefaultSignerService } from '@eco-solver/transaction/smart-wallets/wallet-client.service';
export declare class CCTPV2ProviderService implements IRebalanceProvider<'CCTPV2'> {
    private readonly ecoConfigService;
    private readonly kernelAccountClientService;
    private readonly walletClientService;
    private readonly queue;
    private logger;
    private liquidityManagerQueue;
    private config;
    constructor(ecoConfigService: EcoConfigService, kernelAccountClientService: KernelAccountClientService, walletClientService: WalletClientDefaultSignerService, queue: LiquidityManagerQueueType);
    getStrategy(): "CCTPV2";
    getQuote(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number, id?: string): Promise<RebalanceQuote<'CCTPV2'>[]>;
    execute(walletAddress: string, quote: RebalanceQuote<'CCTPV2'>): Promise<unknown>;
    private _execute;
    fetchV2Attestation(transactionHash: Hex, sourceDomain: number, quoteId?: string): Promise<{
        status: 'pending';
    } | {
        status: 'complete';
        messageBody: Hex;
        attestation: Hex;
    }>;
    receiveV2Message(destinationChainId: number, messageBody: Hex, attestation: Hex, quoteId?: string): Promise<Hex>;
    private fetchV2FeeOptions;
    private getV2ChainConfig;
    private isSupportedToken;
}
