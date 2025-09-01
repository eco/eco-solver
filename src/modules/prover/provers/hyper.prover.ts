import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { encodeAbiParameters, Hex, pad, zeroAddress } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
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
      [[pad(AddressNormalizer.denormalizeToEvm(intent.reward.prover)), '0x', zeroAddress]],
    );
  }

  async getFee(intent: Intent, claimant?: UniversalAddress): Promise<bigint> {
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
    // TODO: Move to validation
    // HyperProver requires 1 hour (3600 seconds) for processing
    return 3600n;
  }
}
