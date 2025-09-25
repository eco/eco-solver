import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { encodeAbiParameters, Hex, pad, zeroAddress } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { AddressNormalizer } from '@/common/utils/address-normalizer';
import { ChainType, ChainTypeDetector } from '@/common/utils/chain-type-detector';
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
    // Detect the source chain VM type
    const sourceChainType = ChainTypeDetector.detect(intent.sourceChainId);
    // The prover address is already in universal (normalized) format (32-byte hex)
    // We need to denormalize it to the source chain format, then re-normalize to get proper 32-byte hex
    const denormalizedProverAddress = AddressNormalizer.denormalize(
      intent.reward.prover,
      sourceChainType,
    );

    // Re-normalize to get proper 32-byte hex format
    const normalizedProverAddress = AddressNormalizer.normalize(
      denormalizedProverAddress as any,
      sourceChainType,
    );
    // The normalized address is already a 32-byte hex string, perfect for our needs
    const paddedProverAddress = normalizedProverAddress as Hex;

    return encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
        },
      ],
      [[paddedProverAddress, '0x', zeroAddress]],
    );
  }

  getDeadlineBuffer(): bigint {
    // TODO: Move to validation
    // HyperProver requires 1 hour (3600 seconds) for processing
    return 3600n;
  }
}
