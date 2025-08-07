import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { Address, encodeAbiParameters, Hex, pad } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { EvmConfigService } from '@/modules/config/services';

@Injectable()
export class MetalayerProver extends BaseProver {
  readonly type = ProverType.METALAYER;

  constructor(
    protected readonly evmConfigService: EvmConfigService,
    protected readonly moduleRef: ModuleRef,
  ) {
    super(evmConfigService, moduleRef);
  }

  async getMessageData(intent: Intent): Promise<Hex> {
    return encodeAbiParameters([{ type: 'bytes32' }], [pad(intent.reward.prover)]);
  }

  async getFee(intent: Intent, claimant?: Address): Promise<bigint> {
    // Fetch fee from the source chain where the intent originates
    return this.blockchainReaderService.fetchProverFee(
      intent.route.source,
      intent,
      await this.getMessageData(intent),
      claimant,
    );
  }

  getDeadlineBuffer(): bigint {
    // MetalayerProver requires 10 minutes (600 seconds) for processing
    return 600n;
  }
}
