import { Hex } from 'viem';

import {
  IntentFulfilledEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { TvmEvent } from '@/modules/blockchain/tvm/types/events.type';

export class TvmEventParser {
  /**
   * Parse IntentFulfilled event from TVM
   * @param chainId The chain ID where the event occurred
   * @param event The raw TVM event object
   * @returns Parsed IntentFulfilledEvent
   */
  static parseTvmIntentFulfilled(chainId: bigint, event: TvmEvent): IntentFulfilledEvent {
    return {
      chainId,
      intentHash: event.result.intentHash as Hex,
      claimant: event.result.claimant as UniversalAddress,
      transactionHash: event.transaction_id,
      blockNumber: BigInt(event.block_number),
      timestamp: new Date(event.block_timestamp),
    };
  }

  static parseIntentProvenEvent(event: TvmEvent, chainId: number): IntentProvenEvent {
    return {
      intentHash: event.result.intentHash as Hex,
      claimant: event.result.claimant as UniversalAddress,
      transactionHash: event.transaction_id,
      blockNumber: BigInt(event.block_number),
      timestamp: new Date(event.block_timestamp),
      chainId: BigInt(chainId),
    };
  }

  static parseIntentWithdrawnEvent(event: TvmEvent, chainId: number): IntentWithdrawnEvent {
    return {
      intentHash: event.result.intentHash as Hex,
      claimant: event.result.claimant as UniversalAddress,
      transactionHash: event.transaction_id,
      blockNumber: BigInt(event.block_number),
      timestamp: new Date(event.block_timestamp),
      chainId: BigInt(chainId),
    };
  }
}
