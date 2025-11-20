import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { encodeAbiParameters, Hex, zeroAddress } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { BlockchainConfigService } from '@/modules/config/services';

@Injectable()
export class HyperProver extends BaseProver {
  readonly type = ProverType.HYPER;

  constructor(
    protected readonly blockchainConfigService: BlockchainConfigService,
    protected readonly moduleRef: ModuleRef,
  ) {
    super(blockchainConfigService, moduleRef);
  }

  async generateProof(intent: Intent): Promise<Hex> {
    return encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
        },
      ],
      [[intent.reward.prover as Hex, '0x', zeroAddress]],
    );
  }

  getDeadlineBuffer(_chainId: number): bigint {
    // TODO: Move to validation
    // HyperProver requires 1 hour (3600 seconds) for processing
    return 3600n;
  }
}
