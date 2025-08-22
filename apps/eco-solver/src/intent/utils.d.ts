import { CallDataInterface } from '@eco-solver/contracts';
import { Solver } from '@libs/solver-config';
import { TransactionTargetData } from '@eco-solver/intent/utils-intent.service';
import { ValidationIntentInterface } from './validation.sevice';
import { Logger } from '@nestjs/common';
/**
 * Decodes the function data for a target contract
 *
 * @param solver the solver for the intent
 * @param call the call to decode
 * @returns
 */
export declare function getTransactionTargetData(solver: Solver, call: CallDataInterface): TransactionTargetData | null;
/**
 * Gets the timeout in milliseconds for waiting for a transaction to be mined
 * on the given chain.
 * @param chainID the chain id
 * @returns the timeout or undefined if not set
 */
export declare function getWaitForTransactionTimeout(chainID: bigint): number;
/**
 * Checks if the intent has any input or output native value components. Indicating
 * that a native token is being used in the intent.
 * @param intent the intent to check
 * @returns
 */
export declare function isNativeIntent(intent: ValidationIntentInterface): boolean;
/**
 * Verifies that the intent has a route that is using the same native token on both chains
 *
 * @param intent the intent model
 * @returns
 */
export declare function equivalentNativeGas(intent: ValidationIntentInterface, logger: Logger): boolean;
/**
 * Iterates over the calls and returns those that do not have empty data
 * Note: The system does not support calls that have both executable data and native value.
 * Only pure transfers (value == 0) are considered valid function calls.
 * @param calls the calls to check
 * @returns
 */
export declare function getFunctionCalls(calls: CallDataInterface[]): {
    target: `0x${string}`;
    data: `0x${string}`;
    value: bigint;
}[];
/**
 * Iterates over the calls and returns those that have empty data and send native value.
 * Note: The system does not support calls that have both executable data and native value.
 * Only pure native transfers (empty data + value > 0) are considered valid native calls.
 *
 * @param calls the calls to check
 * @returns Array of calls that transfer native tokens without executing any functions
 */
export declare function getNativeCalls(calls: CallDataInterface[]): {
    target: `0x${string}`;
    data: `0x${string}`;
    value: bigint;
}[];
/**
 * Calculates the total native token value (ETH, MATIC, etc.) required to fulfill all native value transfers in the intent calls.
 * This includes the sum of all call.value fields for calls that transfer native tokens.
 *
 * @param calls - Array of call data interfaces from the intent route
 * @returns The total native value required in wei (base units) for all native transfers in the intent
 */
export declare function getNativeFulfill(calls: readonly CallDataInterface[]): bigint;
/**
 * Iterates over the calls and returns the targets that do not have empty data
 * @param calls the calls to check
 * @returns
 */
export declare function getFunctionTargets(calls: CallDataInterface[]): `0x${string}`[];
export declare function isNativeETH(intent: ValidationIntentInterface): boolean;
