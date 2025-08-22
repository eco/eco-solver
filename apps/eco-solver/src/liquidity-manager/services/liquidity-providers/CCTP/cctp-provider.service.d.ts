import { Hex } from 'viem';
import { EcoConfigService } from '@libs/solver-config';
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types';
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider';
import { CrowdLiquidityService } from '@eco-solver/intent/crowd-liquidity.service';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { LiquidityManagerQueueType } from '@eco-solver/liquidity-manager/queues/liquidity-manager.queue';
import { WalletClientDefaultSignerService } from '@eco-solver/transaction/smart-wallets/wallet-client.service';
export declare class CCTPProviderService implements IRebalanceProvider<'CCTP'> {
    private readonly ecoConfigService;
    private readonly kernelAccountClientService;
    private readonly walletClientService;
    private readonly crowdLiquidityService;
    private readonly queue;
    private logger;
    private config;
    private liquidityManagerQueue;
    constructor(ecoConfigService: EcoConfigService, kernelAccountClientService: KernelAccountClientService, walletClientService: WalletClientDefaultSignerService, crowdLiquidityService: CrowdLiquidityService, queue: LiquidityManagerQueueType);
    getStrategy(): "CCTP";
    getQuote(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number, id?: string): Promise<RebalanceQuote<'CCTP'>>;
    execute(walletAddress: string, quote: RebalanceQuote<'CCTP'>): Promise<void>;
    /**
     * Execute method that returns transaction metadata for CCTPLiFi integration
     * This does not start the CCTP attestation check job
     * @param walletAddress Wallet address
     * @param quote CCTP quote
     * @returns Transaction metadata including hash, messageHash, and messageBody
     */
    executeWithMetadata(walletAddress: string, quote: RebalanceQuote<'CCTP'>): Promise<{
        txHash: Hex;
        messageHash: Hex;
        messageBody: Hex;
    }>;
    private _execute;
    private executeWithKernel;
    private getCCTPTransactions;
    private getChainConfig;
    fetchAttestation(messageHash: Hex): Promise<{
        status: "pending";
    } | {
        status: "complete";
        attestation: Hex;
    }>;
    private getMessageHash;
    private getMessageBytes;
    receiveMessage(chainId: number, messageBytes: Hex, attestation: Hex): Promise<`0x${string}`>;
    private isSupportedToken;
}
