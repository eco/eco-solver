import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { Address, encodeAbiParameters, Hex, pad } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { EvmConfigService } from '@/modules/config/services';

@Injectable()
export class MetalayerProver extends BaseProver {
  readonly type = ProverType.METALAYER;

  constructor(
    protected readonly evmConfigService: EvmConfigService,
    @Inject(forwardRef(() => BlockchainReaderService))
    private readonly blockchainReaderService: BlockchainReaderService,
  ) {
    super(evmConfigService);
  }

  async getMessageData(intent: Intent): Promise<Hex> {
    return encodeAbiParameters([{ type: 'bytes32' }], [pad(intent.reward.prover)]);
  }

  async getFee(intent: Intent, claimant?: Address): Promise<bigint> {
    // Fetch fee from the source chain where the intent originates
    return this.blockchainReaderService.fetchProverFee(intent.route.source, intent, claimant);
  }
}
