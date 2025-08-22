import { OnApplicationBootstrap } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { Hex } from 'viem';
import { ViemEventLog } from '@eco-solver/common/events/viem';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { TokenBalance, TokenConfig } from '@eco-solver/balance/types';
import { Cache } from '@nestjs/cache-manager';
import { EcoAnalyticsService } from '@eco-solver/analytics';
/**
 * Composite data from fetching the token balances for a chain
 */
export type TokenFetchAnalysis = {
    config: TokenConfig;
    token: TokenBalance;
    chainId: number;
};
/**
 * Service class for getting configs for the app
 */
export declare class BalanceService implements OnApplicationBootstrap {
    private cacheManager;
    private readonly configService;
    private readonly kernelAccountClientService;
    private readonly ecoAnalytics;
    private logger;
    private readonly tokenBalances;
    constructor(cacheManager: Cache, configService: EcoConfigService, kernelAccountClientService: KernelAccountClientService, ecoAnalytics: EcoAnalyticsService);
    onApplicationBootstrap(): Promise<void>;
    /**
     * Updates the token balance of the solver, called from {@link EthWebsocketProcessor}
     * @returns
     */
    updateBalance(balanceEvent: ViemEventLog): void;
    /**
     * Gets the tokens that are in the solver wallets
     * @returns List of tokens that are supported by the solver
     */
    getInboxTokens(): TokenConfig[];
    /**
     * Fetches the balances of the kernel account client of the solver for the given tokens
     * @param chainID the chain id
     * @param tokenAddresses the tokens to fetch balances for
     * @returns
     */
    fetchTokenBalances(chainID: number, tokenAddresses: Hex[]): Promise<Record<Hex, TokenBalance>>;
    /**
     * Fetches the token balances of a wallet for the given token list.
     * @param chainID the chain id
     * @param walletAddress wallet address
     * @param tokenAddresses the tokens to fetch balances for
     * @param cache Flag to enable or disable caching
     * @returns
     */
    fetchWalletTokenBalances(chainID: number, walletAddress: string, tokenAddresses: Hex[], cache?: boolean): Promise<Record<Hex, TokenBalance>>;
    fetchTokenBalance(chainID: number, tokenAddress: Hex): Promise<TokenBalance>;
    fetchTokenBalancesForChain(chainID: number): Promise<Record<Hex, TokenBalance> | undefined>;
    fetchTokenData(chainID: number): Promise<TokenFetchAnalysis[]>;
    getAllTokenData(): Promise<{
        config: TokenConfig;
        balance: TokenBalance;
        chainId: number;
    }[]>;
    /**
     * Gets the native token balance (ETH, MATIC, etc.) for the solver's EOA wallet on the specified chain.
     * This is used to check if the solver has sufficient native funds to cover gas costs and native value transfers.
     *
     * @param chainID - The chain ID to check the native balance on
     * @param address
     * @returns The native token balance in wei (base units), or 0n if no EOA address is found
     */
    getNativeBalance(chainID: number, address: Hex): Promise<bigint>;
    getAllTokenDataForAddress(walletAddress: string, tokens: TokenConfig[]): Promise<{
        config: TokenConfig;
        balance: TokenBalance;
        chainId: number;
    }[]>;
    /**
     * Loads the token balance of the solver
     * @returns
     */
    private loadTokenBalance;
    private loadERC20TokenBalance;
}
