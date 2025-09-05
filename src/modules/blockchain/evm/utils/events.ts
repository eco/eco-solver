import { decodeEventLog, Hex, Log } from 'viem';

import { portalAbi } from '@/common/abis/portal.abi';
import { IntentFulfilledEvent } from '@/common/interfaces/events.interface';
import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';

/**
 * Parse IntentPublished event from EVM logs
 * @param sourceChainId The source chain ID
 * @param rawLog The raw EVM log
 * @returns Parsed Intent object
 */
export function parseIntentPublish(
  sourceChainId: bigint,
  rawLog: Pick<Log, 'topics' | 'data'>,
): Intent {
  const log = decodeEventLog({
    abi: portalAbi,
    eventName: 'IntentPublished',
    topics: rawLog.topics,
    data: rawLog.data,
    strict: true,
  });

  // Decode route based on destination chain type - already returns an Intent format
  const destChainType = ChainTypeDetector.detect(log.args.destination);
  const route = PortalEncoder.decodeFromChain(log.args.route, destChainType, 'route');

  // Normalize all addresses to UniversalAddress format
  return {
    intentHash: log.args.intentHash as Hex,
    destination: log.args.destination,
    sourceChainId,
    route, // Already in Intent format with UniversalAddress from PortalEncoder
    reward: {
      deadline: log.args.rewardDeadline,
      creator: AddressNormalizer.normalize(log.args.creator, ChainType.TVM),
      prover: AddressNormalizer.normalize(log.args.prover, ChainType.TVM),
      nativeAmount: log.args.rewardNativeAmount,
      tokens: log.args.rewardTokens.map((token) => ({
        amount: token.amount,
        token: AddressNormalizer.normalize(token.token, ChainType.TVM),
      })),
    },
  };
}

/**
 * Parse IntentFulfilled event from EVM logs
 * @param chainId The chain ID where the event occurred
 * @param rawLog The raw EVM log
 * @returns Parsed IntentFulfilledEvent object
 */
export function parseIntentFulfilled(chainId: bigint, rawLog: Log): IntentFulfilledEvent {
  const log = decodeEventLog({
    abi: portalAbi,
    eventName: 'IntentFulfilled',
    topics: rawLog.topics,
    data: rawLog.data,
    strict: true,
  });

  return {
    intentHash: log.args.intentHash,
    claimant: log.args.claimant,
    chainId,
    transactionHash: rawLog.transactionHash!,
    blockNumber: rawLog.blockNumber!,
  };
}

// Re-export the IntentFulfilledEvent type from the common interface
export type { IntentFulfilledEvent } from '@/common/interfaces/events.interface';
