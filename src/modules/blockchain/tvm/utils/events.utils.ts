import { IntentFulfilledEvent } from '@/modules/blockchain/evm/utils/events';
import { TvmUtilsService } from '@/modules/blockchain/tvm/services/tvm-utils.service';

/**
 * Parse IntentFulfilled event from TVM
 * @param chainId The chain ID where the event occurred
 * @param event The raw TVM event object
 * @returns Parsed IntentFulfilledEvent
 */
export function parseTvmIntentFulfilled(chainId: bigint, event: any): IntentFulfilledEvent {
  const result = event.result;
  
  return {
    intentHash: result.intentHash || result.hash,
    claimant: result.claimant,
    chainId,
    transactionHash: event.transaction_id,
    blockNumber: event.block_number ? BigInt(event.block_number) : undefined,
  };
}

/**
 * Parse IntentPublished event data from TVM
 * Note: This is extracted from the existing inline parsing in tron.listener.ts
 * for consistency and reusability
 */
export function parseTvmIntentPublished(event: any) {
  const result = event.result;
  
  return {
    intentHash: result.hash,
    destination: BigInt(result.destination),
    creator: TvmUtilsService.fromHex(result.creator),
    prover: TvmUtilsService.fromHex(result.prover),
    rewardDeadline: BigInt(result.rewardDeadline),
    nativeAmount: BigInt(result.nativeAmount),
    rewardTokens: result.rewardTokens,
    route: result.route,
  };
}