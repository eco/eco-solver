import { Hex } from 'viem';

import { BlockchainAddress, UniversalAddress } from '@/common/types/universal-address.type';
import { ChainType } from '@/common/utils/chain-type-detector';

export class Call<addr extends UniversalAddress | BlockchainAddress = UniversalAddress> {
  data: Hex;
  target: addr;
  value: bigint;
}

export interface CoreIntent<
  sourceAddr extends UniversalAddress | BlockchainAddress = UniversalAddress,
  destAddr extends UniversalAddress | BlockchainAddress = UniversalAddress,
> {
  destination: bigint;
  sourceChainId: bigint; // Source chain context
  route: Readonly<{
    salt: Hex;
    deadline: bigint;
    portal: destAddr;
    nativeAmount: bigint;
    tokens: Readonly<
      {
        amount: bigint;
        token: destAddr;
      }[]
    >;
    calls: Readonly<Call<destAddr>[]>;
  }>;
  reward: Readonly<{
    deadline: bigint;
    creator: sourceAddr;
    prover: sourceAddr;
    nativeAmount: bigint;
    tokens: Readonly<
      {
        amount: bigint;
        token: sourceAddr;
      }[]
    >;
  }>;
}

export interface Intent<
  sourceAddr extends UniversalAddress | BlockchainAddress = UniversalAddress,
  destAddr extends UniversalAddress | BlockchainAddress = UniversalAddress,
> extends CoreIntent<sourceAddr, destAddr> {
  intentHash: Hex;
  status?: IntentStatus;
  // Transaction tracking
  publishTxHash?: string; // Transaction hash where intent was published
}

export type BlockchainIntent<source extends ChainType, dest extends ChainType> = Intent<
  BlockchainAddress<source>,
  BlockchainAddress<dest>
>;

export enum IntentStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  EXECUTING = 'EXECUTING',
  FULFILLED = 'FULFILLED',
  FAILED = 'FAILED',
}
