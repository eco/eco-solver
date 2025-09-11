import { BN, web3 } from '@coral-xyz/anchor';

import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { PortalIdlTypes } from '@/modules/blockchain/svm/targets/types/portal-idl.type';
import * as PortalIdlCoder from '@/modules/blockchain/svm/targets/types/portal-idl-coder.type';

import { toBuffer } from './buffer';

export function toSvmRouteForCoder(route: Intent['route']): PortalIdlCoder.RouteInstruction {
  return {
    salt: { 0: Array.from(toBuffer(route.salt)) },
    deadline: new BN(route.deadline.toString()),
    native_amount: new BN(route.nativeAmount.toString()),
    portal: {
      0: Array.from(new web3.PublicKey(AddressNormalizer.denormalizeToSvm(route.portal)).toBytes()),
    },
    tokens: route.tokens.map((t) => ({
      token: new web3.PublicKey(AddressNormalizer.denormalizeToSvm(t.token)),
      amount: new BN(t.amount.toString()),
    })),
    calls: route.calls.map((c) => ({
      target: {
        0: Array.from(new web3.PublicKey(AddressNormalizer.denormalizeToSvm(c.target)).toBytes()),
      },
      data: toBuffer(c.data), // Keep as Buffer, will convert to array later if needed
    })),
  };
}

export function toSvmRewardForCoder(reward: Intent['reward']): PortalIdlCoder.RewardInstruction {
  return {
    deadline: new BN(reward.deadline.toString()),
    creator: new web3.PublicKey(AddressNormalizer.denormalizeToSvm(reward.creator)),
    prover: new web3.PublicKey(AddressNormalizer.denormalizeToSvm(reward.prover)),
    native_amount: new BN(reward.nativeAmount.toString()),
    tokens: reward.tokens.map(({ token, amount }) => ({
      token: new web3.PublicKey(AddressNormalizer.denormalizeToSvm(token)),
      amount: new BN(amount.toString()),
    })),
  };
}

export function toSvmRoute(route: Intent['route']): PortalIdlTypes['route'] {
  const { native_amount, ...rest } = toSvmRouteForCoder(route);
  return { ...rest, nativeAmount: native_amount };
}

export function toSvmReward(reward: Intent['reward']): PortalIdlTypes['reward'] {
  const { native_amount, ...rest } = toSvmRewardForCoder(reward);
  return { ...rest, nativeAmount: native_amount };
}
