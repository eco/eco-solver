/**
 * Intent Conversion Utilities
 *
 * Converts between normalized Intent and blockchain-specific intent formats
 */

import { Intent } from '@/common/interfaces/intent.interface';
import { EVMIntent, SVMIntent, TVMIntent } from '@/common/types/blockchain-intents';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType } from '@/common/utils/chain-type-detector';
import { TronAddress } from '@/modules/blockchain/tvm/types';

/**
 * Converts a normalized Intent to EVM-specific intent
 */
export function toEVMIntent(intent: Intent): EVMIntent {
  return {
    intentHash: intent.intentHash,
    destination: intent.destination,
    sourceChainId: intent.sourceChainId,
    route: toEvmRoute(intent.route),
    reward: toEvmReward(intent.reward),
    status: intent.status,
  };
}

export function toEvmReward(reward: Intent['reward']): EVMIntent['reward'] {
  return {
    deadline: reward.deadline,
    creator: AddressNormalizer.denormalizeToEvm(reward.creator),
    prover: AddressNormalizer.denormalizeToEvm(reward.prover),
    nativeAmount: reward.nativeAmount,
    tokens: reward.tokens.map((token) => ({
      amount: token.amount,
      token: AddressNormalizer.denormalizeToEvm(token.token),
    })),
  };
}

export function toEvmRoute(route: Intent['route']): EVMIntent['route'] {
  return {
    salt: route.salt,
    deadline: route.deadline,
    portal: AddressNormalizer.denormalizeToEvm(route.portal),
    nativeAmount: route.nativeAmount,
    tokens: route.tokens.map((token) => ({
      amount: token.amount,
      token: AddressNormalizer.denormalizeToEvm(token.token),
    })),
    calls: route.calls.map((call) => ({
      data: call.data,
      target: AddressNormalizer.denormalizeToEvm(call.target),
      value: call.value,
    })),
  };
}

/**
 * Converts a normalized Intent to a TVM-specific intent
 */
export function toTVMIntent(intent: Intent): TVMIntent {
  return {
    intentHash: intent.intentHash,
    destination: intent.destination,
    sourceChainId: intent.sourceChainId,
    route: {
      salt: intent.route.salt,
      deadline: intent.route.deadline,
      portal: AddressNormalizer.denormalize(intent.route.portal, ChainType.TVM) as TronAddress,
      nativeAmount: intent.route.nativeAmount,
      tokens: intent.route.tokens.map((token) => ({
        amount: token.amount,
        token: AddressNormalizer.denormalize(token.token, ChainType.TVM) as TronAddress,
      })),
      calls: intent.route.calls.map((call) => ({
        data: call.data,
        target: AddressNormalizer.denormalize(call.target, ChainType.TVM) as TronAddress,
        value: call.value,
      })),
    },
    reward: {
      deadline: intent.reward.deadline,
      creator: AddressNormalizer.denormalize(intent.reward.creator, ChainType.TVM) as TronAddress,
      prover: AddressNormalizer.denormalize(intent.reward.prover, ChainType.TVM) as TronAddress,
      nativeAmount: intent.reward.nativeAmount,
      tokens: intent.reward.tokens.map((token) => ({
        amount: token.amount,
        token: AddressNormalizer.denormalize(token.token, ChainType.TVM) as TronAddress,
      })),
    },
    status: intent.status,
  };
}

/**
 * Converts a normalized Intent to SVM-specific intent
 */
export function toSVMIntent(intent: Intent): SVMIntent {
  return {
    intentHash: intent.intentHash,
    destination: intent.destination,
    sourceChainId: intent.sourceChainId,
    route: {
      salt: intent.route.salt,
      deadline: intent.route.deadline,
      portal: AddressNormalizer.denormalize(intent.route.portal, ChainType.SVM),
      nativeAmount: intent.route.nativeAmount,
      tokens: intent.route.tokens.map((token) => ({
        amount: token.amount,
        token: AddressNormalizer.denormalize(token.token, ChainType.SVM),
      })),
      calls: intent.route.calls.map((call) => ({
        data: call.data,
        target: AddressNormalizer.denormalize(call.target, ChainType.SVM),
        value: call.value,
      })),
    },
    reward: {
      deadline: intent.reward.deadline,
      creator: AddressNormalizer.denormalize(intent.reward.creator, ChainType.SVM),
      prover: AddressNormalizer.denormalize(intent.reward.prover, ChainType.SVM),
      nativeAmount: intent.reward.nativeAmount,
      tokens: intent.reward.tokens.map((token) => ({
        amount: token.amount,
        token: AddressNormalizer.denormalize(token.token, ChainType.SVM),
      })),
    },
    status: intent.status,
  };
}

/**
 * Helper to convert only route portion of intent
 */
export function toEVMRoute(route: Intent['route']): EVMIntent['route'] {
  return {
    salt: route.salt,
    deadline: route.deadline,
    portal: AddressNormalizer.denormalizeToEvm(route.portal),
    nativeAmount: route.nativeAmount,
    tokens: route.tokens.map((token) => ({
      amount: token.amount,
      token: AddressNormalizer.denormalizeToEvm(token.token),
    })),
    calls: route.calls.map((call) => ({
      data: call.data,
      target: AddressNormalizer.denormalizeToEvm(call.target),
      value: call.value,
    })),
  };
}

/**
 * Helper to convert only a reward portion of intent
 */
export function toEVMReward(reward: Intent['reward']): EVMIntent['reward'] {
  return {
    deadline: reward.deadline,
    creator: AddressNormalizer.denormalizeToEvm(reward.creator),
    prover: AddressNormalizer.denormalizeToEvm(reward.prover),
    nativeAmount: reward.nativeAmount,
    tokens: reward.tokens.map((token) => ({
      amount: token.amount,
      token: AddressNormalizer.denormalizeToEvm(token.token),
    })),
  };
}
