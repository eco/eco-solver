import { Logs } from '@solana/web3.js';

import {
  IntentFulfilledEvent,
  IntentFundedEvent,
  IntentProvenEvent,
  IntentWithdrawnEvent,
} from '@/common/interfaces/events.interface';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import {
  IntentFulfilledInstruction,
  IntentFundedInstruction,
  IntentProvenInstruction,
  IntentPublishedInstruction,
  IntentWithdrawnInstruction,
} from '@/modules/blockchain/svm/targets/types/portal-idl-coder.type';
import { bufferToBytes } from '@/modules/blockchain/svm/utils/converter';

export class SvmEventParser {
  static parseIntentPublishEvent(
    ev: IntentPublishedInstruction,
    log: Logs,
    sourceChainId: number,
  ): Intent {
    const destination = BigInt(ev.destination.toString());

    // Decode route based on destination chain type
    const destChainType = ChainTypeDetector.detect(destination);
    const decodedRoute = PortalEncoder.decode(ev.route, destChainType, 'route');

    return {
      sourceChainId: BigInt(sourceChainId), // Solana chainId
      destination,
      intentHash: bufferToBytes(ev.intent_hash[0]),
      status: IntentStatus.PENDING,
      publishTxHash: log.signature,
      route: decodedRoute,
      reward: {
        deadline: BigInt(ev.reward.deadline.toString()),
        prover: AddressNormalizer.normalizeSvm(ev.reward.prover),
        creator: AddressNormalizer.normalizeSvm(ev.reward.creator),
        nativeAmount: BigInt(ev.reward.native_amount.toString()),
        tokens: ev.reward.tokens.map((token) => ({
          amount: BigInt(token.amount.toString()),
          token: AddressNormalizer.normalizeSvm(token.token),
        })),
      },
    };
  }

  static parseIntentFundedEvent(
    evt: IntentFundedInstruction,
    logs: Logs,
    chainId: number,
  ): IntentFundedEvent {
    return {
      intentHash: bufferToBytes(evt.intent_hash[0]),
      funder: AddressNormalizer.normalizeSvm(evt.funder),
      complete: evt.complete,
      transactionHash: logs.signature,
      chainId: BigInt(chainId),
      timestamp: new Date(),
    };
  }

  static parseIntentFulfilledEvent(
    evt: IntentFulfilledInstruction,
    logs: Logs,
    chainId: number,
  ): IntentFulfilledEvent {
    return {
      intentHash: bufferToBytes(evt.intent_hash[0]),
      claimant: bufferToBytes(evt.claimant[0]) as UniversalAddress,
      transactionHash: logs.signature,
      chainId: BigInt(chainId),
      timestamp: new Date(),
    };
  }

  static parseIntentWithdrawnFromLogs(
    evt: IntentWithdrawnInstruction,
    logs: Logs,
    chainId: number,
  ): IntentWithdrawnEvent {
    return {
      intentHash: bufferToBytes(evt.intent_hash[0]),
      claimant: AddressNormalizer.normalizeSvm(evt.claimant),
      transactionHash: logs.signature,
      chainId: BigInt(chainId),
      timestamp: new Date(),
    };
  }

  static parseIntentProvenEvent(
    evt: IntentProvenInstruction,
    logs: Logs,
    chainId: number,
  ): IntentProvenEvent {
    return {
      intentHash: bufferToBytes(evt.intent_hash[0]),
      claimant: bufferToBytes(evt.claimant[0]) as UniversalAddress,
      transactionHash: logs.signature,
      blockNumber: undefined,
      chainId: BigInt(chainId),
      timestamp: new Date(),
    };
  }
}
