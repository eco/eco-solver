import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { Hex } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { BlockchainConfigService } from '@/modules/config/services';

@Injectable()
export class DummyProver extends BaseProver {
  readonly type = ProverType.DUMMY;

  constructor(
    protected readonly blockchainConfigService: BlockchainConfigService,
    protected readonly moduleRef: ModuleRef,
  ) {
    super(blockchainConfigService, moduleRef);
  }

  async generateProof(_intent: Intent): Promise<Hex> {
    return '0x';
  }

  async getFee(_intent: Intent, _claimant?: UniversalAddress): Promise<bigint> {
    // Fetch fee from the source chain where the intent originates
    return 0n;
  }

  getDeadlineBuffer(): bigint {
    // TODO: Move to validation
    // MetalayerProver requires 100 minutes (6000 seconds) for processing
    return 600n;
  }
}
