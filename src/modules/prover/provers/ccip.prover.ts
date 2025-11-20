import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { encodeAbiParameters, Hex } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { BlockchainConfigService, ProversConfigService } from '@/modules/config/services';

@Injectable()
export class CcipProver extends BaseProver {
  readonly type = ProverType.CCIP;

  constructor(
    protected readonly blockchainConfigService: BlockchainConfigService,
    protected readonly moduleRef: ModuleRef,
    private readonly proversConfigService: ProversConfigService,
  ) {
    super(blockchainConfigService, moduleRef);
  }

  async generateProof(intent: Intent): Promise<Hex> {
    const sourceChainId = Number(intent.sourceChainId);

    // Use centralized prover config instead of per-network config
    const gasLimit = this.proversConfigService.getCcipGasLimit();
    const allowOutOfOrderExecution = this.proversConfigService.getCcipAllowOutOfOrderExecution();

    // Encode proof data: (uint64 sourceChainId, uint256 gasLimit, bool allowOutOfOrderExecution)
    return encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [{ type: 'uint64' }, { type: 'uint256' }, { type: 'bool' }],
        },
      ],
      [[BigInt(sourceChainId), BigInt(gasLimit), allowOutOfOrderExecution]],
    );
  }

  getDeadlineBuffer(_chainId: number): bigint {
    // Use global CCIP deadline buffer from ProversConfigService
    return BigInt(this.proversConfigService.getCcipDeadlineBuffer());
  }
}
