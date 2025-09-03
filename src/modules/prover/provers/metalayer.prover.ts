import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { encodeAbiParameters, Hex, pad } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { BlockchainConfigService } from '@/modules/config/services';

@Injectable()
export class MetalayerProver extends BaseProver {
  readonly type = ProverType.METALAYER;

  constructor(
    protected readonly blockchainConfigService: BlockchainConfigService,
    protected readonly moduleRef: ModuleRef,
  ) {
    super(blockchainConfigService, moduleRef);
  }

  async generateProof(intent: Intent): Promise<Hex> {
    return encodeAbiParameters([{ type: 'bytes32' }], [
      pad(AddressNormalizer.denormalizeToEvm(intent.reward.prover)),
    ] as const);
  }

  async getFee(intent: Intent, claimant?: UniversalAddress): Promise<bigint> {
    const chainId = intent.sourceChainId;

    const prover = this.getContractAddress(chainId);
    if (!prover) {
      throw new Error(`No prover contract address found for chain ${chainId}`);
    }

    // Fetch fee from the source chain where the intent originates
    return this.blockchainReaderService.fetchProverFee(
      chainId,
      intent,
      prover,
      await this.generateProof(intent),
      claimant,
    );
  }

  getDeadlineBuffer(): bigint {
    // TODO: Move to validation
    // MetalayerProver requires 100 minutes (6000 seconds) for processing
    return 6000n;
  }
}
