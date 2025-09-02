import { Hex } from 'viem';

import {
  IntentFulfilledEvent,
  PortalEventArgs,
  RawEventLogs,
} from '@/common/interfaces/events.interface';
import { TvmUtilsService } from '@/modules/blockchain/tvm/services/tvm-utils.service';

/**
 * Parse IntentFulfilled event from TVM
 * @param chainId The chain ID where the event occurred
 * @param event The raw TVM event object
 * @returns Parsed IntentFulfilledEvent
 */
export function parseTvmIntentFulfilled(
  chainId: bigint,
  event: RawEventLogs.TvmEvent,
): IntentFulfilledEvent {
  const result = event.result;

  return {
    intentHash: (result.intentHash || result.hash) as Hex,
    claimant: result.claimant as Hex,
    chainId,
    transactionHash: event.transaction_id,
    blockNumber: event.block_number ? BigInt(event.block_number) : undefined,
  };
}

/**
 * Parse IntentPublished event data from TVM
 * @param event The raw TVM event object
 * @returns Parsed event data matching Portal event structure
 */
export function parseTvmIntentPublished(
  event: RawEventLogs.TvmEvent,
): Partial<PortalEventArgs.IntentPublished> & { intentHash: Hex } {
  const result = event.result;

  return {
    intentHash: result.hash as Hex,
    destination: BigInt(result.destination),
    creator: TvmUtilsService.fromHex(result.creator) as unknown as Hex,
    prover: TvmUtilsService.fromHex(result.prover) as unknown as Hex,
    rewardDeadline: BigInt(result.rewardDeadline),
    rewardNativeAmount: BigInt(result.nativeAmount),
    rewardTokens: result.rewardTokens || [],
    route: result.route as Hex,
  };
}
