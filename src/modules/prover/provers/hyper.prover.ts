import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { Address, encodeAbiParameters, Hex, pad, zeroAddress } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { EvmConfigService } from '@/modules/config/services';

@Injectable()
export class HyperProver extends BaseProver {
  readonly type = ProverType.HYPER;

  constructor(
    protected readonly evmConfigService: EvmConfigService,
    protected readonly moduleRef: ModuleRef,
  ) {
    super(evmConfigService, moduleRef);
  }

  async generateProof(intent: Intent): Promise<Hex> {
    return encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
        },
      ],
      [[pad(intent.reward.prover), '0x', zeroAddress]],
    );
  }

  async getFee(intent: Intent, claimant?: Address): Promise<bigint> {
    const localProver = this.getContractAddress(Number(intent.destination));

    // Fetch fee from the source chain where the intent originates
    return this.blockchainReaderService.fetchProverFee(
      intent.destination,
      intent,
      localProver,
      await this.generateProof(intent),
      claimant,
    );
  }

  getDeadlineBuffer(): bigint {
    // HyperProver requires 1 hour (3600 seconds) for processing
    return 3600n;
  }
}
