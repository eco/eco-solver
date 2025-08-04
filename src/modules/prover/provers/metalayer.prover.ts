import { Injectable } from '@nestjs/common';

import { encodeAbiParameters, Hex, pad } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';

@Injectable()
export class MetalayerProver extends BaseProver {
  readonly type = ProverType.METALAYER;

  async getMessageData(intent: Intent): Promise<Hex> {
    return encodeAbiParameters([{ type: 'bytes32' }], [pad(intent.reward.prover)]);
  }
}
