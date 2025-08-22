import { OnModuleInit } from '@nestjs/common';
import { EcoConfigService } from '@libs/solver-config';
import { Hex } from 'viem';
import { MultichainPublicClientService } from '@eco-solver/transaction/multichain-public-client.service';
import { IFulfillService } from '@eco-solver/intent/interfaces/fulfill-service.interface';
import { Solver } from '@libs/solver-config';
import { IntentSourceModel } from '@eco-solver/intent/schemas/intent-source.schema';
import { TokenData } from '@eco-solver/liquidity-manager/types/types';
import { BalanceService } from '@eco-solver/balance/balance.service';
import { TokenConfig } from '@eco-solver/balance/types';
import { EcoAnalyticsService } from '@eco-solver/analytics';
export declare class CrowdLiquidityService implements OnModuleInit, IFulfillService {
    private readonly ecoConfigService;
    private readonly publicClient;
    private readonly balanceService;
    private readonly ecoAnalytics;
    private logger;
    private config;
    constructor(ecoConfigService: EcoConfigService, publicClient: MultichainPublicClientService, balanceService: BalanceService, ecoAnalytics: EcoAnalyticsService);
    onModuleInit(): void;
    /**
     * Executes the process to fulfill an intent based on the provided model and solver.
     *
     * @param {IntentSourceModel} model - The source model containing the intent and related chain information.
     * @param {Solver} solver - The solver instance used to resolve the intent.
     * @return {Promise<Hex>} A promise that resolves to the hexadecimal hash representing the result of the fulfilled intent.
     */
    fulfill(model: IntentSourceModel, solver: Solver): Promise<Hex>;
    rebalanceCCTP(tokenIn: TokenData, tokenOut: TokenData): Promise<`0x${string}`>;
    /**
     * Determines if a given route.
     *
     * @param {IntentSourceModel} intentModel - The model containing intent data, including route information.
     * @return {boolean} - Returns true if the route is supported, otherwise false.
     */
    isRouteSupported(intentModel: IntentSourceModel): boolean;
    /**
     * Determines if the reward provided in the intent model is sufficient based on the route amount and the fee percentage.
     *
     * @param {IntentSourceModel} intentModel - The intent model containing the route and reward information.
     * @return {boolean} - Returns true if the total reward amount is greater than or equal to the calculated minimum required reward; otherwise, false.
     */
    isRewardEnough(intentModel: IntentSourceModel): boolean;
    /**
     * Retrieves the list of supported tokens with their configuration details.
     *
     * @return {TokenConfig[]} Array of supported tokens, each including token details and the corresponding target balance.
     */
    getSupportedTokens(): TokenConfig[];
    /**
     * Checks if the given intent is solvent, ensuring all required token balances meet or exceed the specified amounts.
     *
     * @param {IntentSourceModel} intentModel - The intent model containing route information and token requirements.
     * @return {Promise<boolean>} - A promise that resolves to true if the intent is solvent, otherwise false.
     */
    isPoolSolvent(intentModel: IntentSourceModel): Promise<boolean>;
    /**
     * Checks if a token with the specified chain ID and address is supported.
     *
     * @param {number} chainId - The chain ID of the token to check.
     * @param {Hex} address - The address of the token to check.
     * @return {boolean} Returns true if the token is supported; otherwise, false.
     */
    isSupportedToken(chainId: number, address: Hex): boolean;
    /**
     * Checks if a token with the specified chain ID and address is supported.
     *
     * @param {number} chainId - The chain ID of the token to check.
     * @param {Hex} address - The address of the token to check.
     * @return {boolean} Returns true if the token is supported; otherwise, false.
     */
    getTokenTargetBalance(chainId: number, address: Hex): number;
    /**
     * Retrieves the pool address from the configuration.
     *
     * @return {string} The address of the pool as specified in the configuration.
     */
    getPoolAddress(): Hex;
    private _fulfill;
    private callLitAction;
    /**
     * Checks if the provided data represents a supported action.
     *
     * @param {Hex} data - The data to be evaluated, which is expected to contain encoded function calls.
     * @return {boolean} Returns true if the data is a supported action; otherwise, false.
     */
    private isSupportedAction;
    private getViemWallet;
    private getFeeData;
}
