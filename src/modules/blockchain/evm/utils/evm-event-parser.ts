import { decodeEventLog, Hex, Log } from 'viem';

import { messageBridgeProverAbi } from '@/common/abis/message-bridge-prover.abi';
import { portalAbi } from '@/common/abis/portal.abi';
import {
  IntentFulfilledEvent,
  IntentFundedEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';

export class EvmEventParser {
  /**
   * Parse IntentPublished event from EVM logs
   * @param sourceChainId The source chain ID
   * @param rawLog The raw EVM log
   * @returns Parsed Intent object
   */
  static parseIntentPublish(sourceChainId: bigint, rawLog: Pick<Log, 'topics' | 'data'>): Intent {
    const log = decodeEventLog({
      abi: portalAbi,
      eventName: 'IntentPublished',
      topics: rawLog.topics,
      data: rawLog.data,
      strict: true,
    });

    // Decode route based on the destination chain type - already returns an Intent format
    const srcChainType = ChainTypeDetector.detect(sourceChainId);
    const destChainType = ChainTypeDetector.detect(log.args.destination);
    const route = PortalEncoder.decode(log.args.route, destChainType, 'route');

    // Normalize all addresses to UniversalAddress format
    return {
      intentHash: log.args.intentHash as Hex,
      destination: log.args.destination,
      sourceChainId,
      route, // Already in Intent format with UniversalAddress from PortalEncoder
      reward: {
        deadline: log.args.rewardDeadline,
        creator: AddressNormalizer.normalize(log.args.creator, srcChainType),
        prover: AddressNormalizer.normalize(log.args.prover, srcChainType),
        nativeAmount: log.args.rewardNativeAmount,
        tokens: log.args.rewardTokens.map((token) => ({
          amount: token.amount,
          token: AddressNormalizer.normalize(token.token, srcChainType),
        })),
      },
    };
  }

  /**
   * Parse IntentFunded event from EVM logs
   * @param chainId The chain ID where the event occurred
   * @param rawLog The raw EVM log
   * @returns Parsed IntentFundedEvent object
   */
  static parseIntentFunded(chainId: bigint, rawLog: Log<bigint, number, false>): IntentFundedEvent {
    const log = decodeEventLog({
      abi: portalAbi,
      eventName: 'IntentFunded',
      topics: rawLog.topics,
      data: rawLog.data,
      strict: true,
    });

    return {
      chainId,
      intentHash: log.args.intentHash,
      funder: AddressNormalizer.normalizeEvm(log.args.funder),
      complete: log.args.complete,
      timestamp: new Date(),
      blockNumber: rawLog.blockNumber,
      transactionHash: rawLog.transactionHash,
    };
  }

  /**
   * Parse IntentFulfilled event from EVM logs
   * @param chainId The chain ID where the event occurred
   * @param rawLog The raw EVM log
   * @returns Parsed IntentFulfilledEvent object
   */
  static parseIntentFulfilled(
    chainId: bigint,
    rawLog: Log<bigint, number, false>,
  ): IntentFulfilledEvent {
    const log = decodeEventLog({
      abi: portalAbi,
      eventName: 'IntentFulfilled',
      topics: rawLog.topics,
      data: rawLog.data,
      strict: true,
    });

    return {
      chainId,
      intentHash: log.args.intentHash,
      claimant: log.args.claimant as UniversalAddress,
      timestamp: new Date(),
      blockNumber: rawLog.blockNumber,
      transactionHash: rawLog.transactionHash,
    };
  }

  static parseIntentProven(chainId: number, rawLog: Log<bigint, number, false>): IntentProvenEvent {
    const log = decodeEventLog({
      abi: messageBridgeProverAbi,
      eventName: 'IntentProven',
      topics: rawLog.topics,
      data: rawLog.data,
      strict: true,
    });

    return {
      chainId: BigInt(chainId),
      intentHash: log.args.intentHash,
      claimant: log.args.claimant as UniversalAddress,
      timestamp: new Date(),
      blockNumber: rawLog.blockNumber,
      transactionHash: rawLog.transactionHash,
    };
  }

  static parseIntentWithdrawn(
    chainId: number,
    rawLog: Log<bigint, number, false>,
  ): IntentWithdrawnEvent {
    const log = decodeEventLog({
      abi: portalAbi,
      eventName: 'IntentWithdrawn',
      topics: rawLog.topics,
      data: rawLog.data,
      strict: true,
    });

    return {
      chainId: BigInt(chainId),
      intentHash: log.args.intentHash,
      claimant: log.args.claimant as UniversalAddress,
      timestamp: new Date(),
      transactionHash: rawLog.transactionHash,
      blockNumber: rawLog.blockNumber,
    };
  }
}
