import { Injectable } from '@nestjs/common';

import { encodeAbiParameters, Hex, pad, zeroAddress } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';

@Injectable()
export class HyperProver extends BaseProver {
  readonly type = ProverType.HYPER;

  async getMessageData(intent: Intent): Promise<Hex> {
    return encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
      [pad(intent.reward.prover), '0x', zeroAddress],
    );
  }
}
