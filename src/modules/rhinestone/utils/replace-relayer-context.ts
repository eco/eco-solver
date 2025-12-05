/**
 * Replace Relayer Context in Rhinestone Router Calls
 *
 * Based on rhinestone-relayer/src/helpers/rebalancing.ts
 *
 * This utility replaces the relayerContexts parameter in Router calls
 * to ensure solver rewards go to the correct address.
 *
 * For Eco Protocol:
 * - relayerContext is just an address (the claimant)
 * - This becomes the reward recipient after WITHDRAW
 * - Must be set to the solver's address, not the placeholder
 *
 * Reference: https://github.com/rhinestonewtf/compact-utils/blob/main/src/router/core/RouterLogic.sol#L189
 */

import { Address, decodeFunctionData, encodeFunctionData, encodePacked, Hex } from 'viem';

import { rhinestoneRouterAbi } from '@/common/abis/rhinestone-router.abi';

/**
 * Replaces relayerContexts in Router calls (CLAIM/FILL) with the solver's address
 *
 * For Eco adapters, the relayerContext is encoded as: encodePacked(['address'], [solverAddress])
 * This address becomes the claimant who receives rewards during WITHDRAW.
 *
 * Supports: routeClaim, routeFill, optimized_routeFill921336808
 *
 * @param routerCalldata Original router call data from Rhinestone payload (CLAIM or FILL)
 * @param solverAddress The solver's address that should receive rewards
 * @returns Modified call data with solver address in relayerContexts
 *
 * @example
 * const patchedClaimData = replaceRelayerContext(claimAction.call.data, solverAddress);
 * const patchedFillData = replaceRelayerContext(fillAction.call.data, solverAddress);
 */
export function replaceRelayerContext(routerCalldata: Hex, solverAddress: Address): Hex {
  // Decode the router function call
  const routerCall = decodeFunctionData({
    abi: rhinestoneRouterAbi,
    data: routerCalldata,
  });

  // Validate it's a router call we can handle
  // Reference: rhinestone-relayer/src/helpers/rebalancing.ts line 21-25
  const supportedFunctions = ['routeClaim', 'routeFill', 'optimized_routeFill921336808'];
  if (!supportedFunctions.includes(routerCall.functionName)) {
    throw new Error(
      `Unsupported router function: ${routerCall.functionName}. Expected routeClaim, routeFill, or optimized_routeFill921336808`,
    );
  }

  // Get the relayerContexts array (first parameter)
  const relayerContexts = routerCall.args[0] as Hex[];

  if (relayerContexts.length === 0) {
    throw new Error('No relayerContexts found in router call');
  }

  // For Eco adapters, the relayerContext is just an address
  // Reference: rhinestone-relayer/src/helpers/rebalancing.ts line 160-166
  const newRelayerContext = encodePacked(['address'], [solverAddress]);

  // Replace ALL relayerContexts with the solver's address
  // In multiclaim batched fills, there's one relayerContext per eco_handleFill call
  const newRelayerContexts = relayerContexts.map(() => newRelayerContext);

  // Re-encode the router call with the new relayerContexts
  const newArgs = [...routerCall.args];
  newArgs[0] = newRelayerContexts;

  return encodeFunctionData({
    abi: rhinestoneRouterAbi,
    functionName: routerCall.functionName,
    // @ts-expect-error minor type error
    args: newArgs,
  });
}
