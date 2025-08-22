import { OnModuleInit } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { KernelAccountClientV2Service } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client-v2.service';
import { RebalanceQuote, TokenData } from '@eco-solver/liquidity-manager/types/types';
import { IRebalanceProvider } from '@eco-solver/liquidity-manager/interfaces/IRebalanceProvider';
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service';
export declare class StargateProviderService implements OnModuleInit, IRebalanceProvider<'Stargate'> {
    private readonly ecoConfigService;
    private readonly kernelAccountClientService;
    private readonly multiChainPublicClientService;
    private logger;
    private walletAddress;
    private chainKeyMap;
    constructor(ecoConfigService: EcoConfigService, kernelAccountClientService: KernelAccountClientV2Service, multiChainPublicClientService: MultichainPublicClientService);
    onModuleInit(): Promise<void>;
    getStrategy(): "Stargate";
    getQuote(tokenIn: TokenData, tokenOut: TokenData, swapAmount: number): Promise<RebalanceQuote<'Stargate'>>;
    execute(walletAddress: string, quote: RebalanceQuote<'Stargate'>): Promise<void>;
    private selectRoute;
    private _execute;
    /**
     * Gets the chain key for a given chain ID, loading from API if needed
     * @param chainId The chain ID to get the key for
     * @returns The chain key string or undefined if not found
     */
    private getChainKey;
    /**
     * Gets the chain ID for a given chain key, loading from API if needed
     * @param chainKey The chain key to get the chain id for
     * @returns The corresponding chain id
     */
    private getChainIdFromChainKey;
    /**
     * Loads chain keys from Stargate API if they haven't been loaded already
     * @returns A promise that resolves when the chains are loaded
     */
    private loadChainKeys;
    /**
     * Calculates the minimum acceptable destination amount based on the configured
     * maximum slippage. All math is performed with BigInt to avoid precision loss.
     *
     * amountIn * (1 - maxSlippage) is implemented in integer arithmetic by
     * converting the percentage to basis points (bps) and performing a ceil-div.
     */
    private calculateAmountMin;
}
