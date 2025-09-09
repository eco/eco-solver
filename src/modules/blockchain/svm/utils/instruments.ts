import { BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

import { Intent } from '@/common/interfaces/intent.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { RouteInstruction } from '@/modules/blockchain/svm/targets/types/portal-idl.type';
import { addressToBytes32 } from '@/modules/blockchain/svm/utils/converter';

import { toBuffer } from './buffer';

export function prepareSvmRoute(route: Intent['route']): RouteInstruction {
  return {
    salt: { 0: Array.from(toBuffer(route.salt)) },
    deadline: new BN(route.deadline.toString()),
    nativeAmount: new BN('0'),
    portal: { 0: addressToBytes32(AddressNormalizer.denormalizeToSvm(route.portal)) },
    tokens: route.tokens.map((t) => ({
      token: new PublicKey(AddressNormalizer.denormalizeToSvm(t.token)),
      amount: new BN(t.amount.toString()),
    })),
    calls: route.calls.map((c) => ({
      target: { 0: addressToBytes32(AddressNormalizer.denormalizeToSvm(c.target)) },
      data: toBuffer(c.data),
    })),
  };
}
