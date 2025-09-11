import { Logs } from '@solana/web3.js';

import { EventMap } from '@/common/events';
import { IntentWithdrawnEvent } from '@/common/interfaces/events.interface';
import { Intent, IntentStatus } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainTypeDetector } from '@/common/utils/chain-type-detector';
import { PortalEncoder } from '@/common/utils/portal-encoder';
import {
  IntentFulfilledInstruction,
  IntentPublishedInstruction,
  IntentWithdrawnInstruction,
} from '@/modules/blockchain/svm/targets/types/portal-idl.type';
import { Snakify } from '@/modules/blockchain/svm/types/snake-case.types';
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

    // TODO: Fix Snakify Deep issue
    const reward = ev.reward as unknown as Snakify<IntentPublishedInstruction['reward']>;

    return {
      sourceChainId: BigInt(sourceChainId), // Solana chainId
      destination,
      intentHash: bufferToBytes(ev.intent_hash[0]),
      status: IntentStatus.PENDING,
      publishTxHash: log.signature,
      route: decodedRoute,
      reward: {
        deadline: BigInt(reward.deadline.toString()),
        prover: AddressNormalizer.normalizeSvm(reward.prover),
        creator: AddressNormalizer.normalizeSvm(reward.creator),
        nativeAmount: BigInt(reward.native_amount.toString()),
        tokens: reward.tokens.map((token) => ({
          amount: BigInt(token.amount.toString()),
          token: AddressNormalizer.normalizeSvm(token.token),
        })),
      },
    };
  }

  static parseIntentFulfilledEvent(
    evt: IntentFulfilledInstruction,
    logs: Logs,
    chainId: number,
  ): EventMap['intent.fulfilled'] {
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
}
