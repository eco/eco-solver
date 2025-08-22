import { EcoConfigService } from '@libs/solver-config';
import { Solver } from '@libs/solver-config';
import { FeeService } from '@eco-solver/fee/fee.service';
import { TransactionTargetData } from '@eco-solver/intent/utils-intent.service';
import { ProofService } from '@eco-solver/prover/proof.service';
import { QuoteIntentDataInterface } from '@eco-solver/quote/dto/quote.intent.data.dto';
import { OnModuleInit } from '@nestjs/common';
import { Hex } from 'viem';
import { BalanceService } from '@eco-solver/balance/balance.service';
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service';
import { CrowdLiquidityService } from '@eco-solver/intent/crowd-liquidity.service';
interface IntentModelWithHashInterface {
    hash?: Hex;
}
/**
 * Validation type that mixes the QuoteIntentDataDTO with the hash. This is used to
 * merge quotes and intents validations
 */
export interface ValidationIntentInterface extends QuoteIntentDataInterface, IntentModelWithHashInterface {
}
/**
 * Type that holds all the possible validations that can fail
 */
export type ValidationChecks = {
    supportedProver: boolean;
    supportedNative: boolean;
    supportedTargets: boolean;
    supportedTransaction: boolean;
    validTransferLimit: boolean;
    validExpirationTime: boolean;
    validDestination: boolean;
    fulfillOnDifferentChain: boolean;
    sufficientBalance: boolean;
};
/**
 * Validates that all the validations succeeded
 * @param validations  the validations to check
 * @returns true if all the validations passed
 */
export declare function validationsSucceeded(validations: ValidationType): boolean;
/**
 * Checks that at least one of the validations failed
 * @param validations the validations to check
 * @returns true if any of the validations failed
 */
export declare function validationsFailed(validations: ValidationType): boolean;
/**
 * Type that holds all the possible validations that can fail
 */
export type ValidationType = {
    [key in keyof ValidationChecks]: boolean;
};
export type TxValidationFn = (tx: TransactionTargetData) => boolean;
export declare class ValidationService implements OnModuleInit {
    private readonly proofService;
    private readonly feeService;
    private readonly balanceService;
    private readonly ecoConfigService;
    private readonly crowdLiquidityService;
    private readonly kernelAccountClientService;
    private isNativeETHSupported;
    private readonly logger;
    private minEthBalanceWei;
    constructor(proofService: ProofService, feeService: FeeService, balanceService: BalanceService, ecoConfigService: EcoConfigService, crowdLiquidityService: CrowdLiquidityService, kernelAccountClientService: KernelAccountClientService);
    onModuleInit(): void;
    /**
     * Executes all the validations we have on the model and solver
     *
     * @param intent the source intent model
     * @param solver the solver for the source chain
     * @param txValidationFn
     * @returns true if they all pass, false otherwise
     */
    assertValidations(intent: ValidationIntentInterface, solver: Solver, txValidationFn?: TxValidationFn): Promise<ValidationChecks>;
    /**
     * Checks if a given source chain ID and prover are supported within the available intent sources.
     *
     * @param {Object} opts - The operation parameters.
     * @param {bigint} opts.chainID - The ID of the chain to check for support.
     * @param {Hex} opts.prover - The prover to validate against the intent sources.
     * @return {boolean} Returns true if the source chain ID and prover are supported, otherwise false.
     */
    supportedProver(opts: {
        source: number;
        destination: number;
        prover: Hex;
    }): boolean;
    checkProverWhitelisted(chainID: number, prover: Hex): boolean;
    /**
     * Verifies that the intent is a supported native.
     *
     * If native intents are enabled, it checks that the native token is the same on both chains
     * If native intents are disabled, it checks that the intent is not a native intent and has no native value components
     *
     * @param intent the intent model
     * @returns
     */
    supportedNative(intent: ValidationIntentInterface): boolean;
    /**
     * Verifies that all the intent targets are supported by the solver. The targets must
     * have data in the transaction in order to be checked. Non-data targets are expected to be
     * pure gas token transfers
     *
     * @param intent the intent model
     * @param solver the solver for the intent
     * @returns
     */
    supportedTargets(intent: ValidationIntentInterface, solver: Solver): boolean;
    /**
     * Verifies that the intent calls that are function calls are supported by the solver.
     *
     * @param intent the intent model
     * @param solver the solver for the intent
     * @param txValidationFn
     * @returns
     */
    supportedTransaction(intent: ValidationIntentInterface, solver: Solver, txValidationFn?: TxValidationFn): boolean;
    /**
     * Checks if the transfer total is within the bounds of the solver, ie below a certain threshold
     * @param intent the source intent model
     * @returns  true if the transfer is within the bounds
     */
    validTransferLimit(intent: ValidationIntentInterface): Promise<boolean>;
    /**
     * Checks if the solver has sufficient balance in its wallets to fulfill the transaction
     * @param intent the source intent model
     * @returns true if the solver has sufficient balance
     */
    hasSufficientBalance(intent: ValidationIntentInterface): Promise<boolean>;
    /**
     *
     * @param intent the source intent model
     * @returns
     */
    validExpirationTime(intent: ValidationIntentInterface): boolean;
    /**
     * Checks that the intent destination is supported by the solver
     * @param intent the source intent model
     * @returns
     */
    validDestination(intent: ValidationIntentInterface): boolean;
    /**
     * Checks that the intent fulfillment is on a different chain than its source
     * Needed since some proving methods(Hyperlane) cant prove same chain
     * @param intent the source intent
     * @returns
     */
    fulfillOnDifferentChain(intent: ValidationIntentInterface): boolean;
    /**
     * Checks if the solver has sufficient token balances
     * @private
     */
    private checkTokenBalances;
    /**
     * Checks if the solver has sufficient native balance
     * @private
     */
    private sufficientNativeBalance;
}
export {};
