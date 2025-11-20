import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { encodeAbiParameters, Hex } from 'viem';

import { BaseProver } from '@/common/abstractions/base-prover.abstract';
import { Intent } from '@/common/interfaces/intent.interface';
import { ProverType } from '@/common/interfaces/prover.interface';
import { BlockchainConfigService } from '@/modules/config/services';
import { EvmConfigService } from '@/modules/config/services/evm-config.service';

@Injectable()
export class CcipProver extends BaseProver {
  readonly type = ProverType.CCIP;

  constructor(
    protected readonly blockchainConfigService: BlockchainConfigService,
    protected readonly moduleRef: ModuleRef,
    private readonly evmConfigService: EvmConfigService,
  ) {
    super(blockchainConfigService, moduleRef);
  }

  async generateProof(intent: Intent): Promise<Hex> {
    // Get CCIP configuration for the source chain
    const sourceChainId = Number(intent.sourceChainId);
    const ccipConfig = this.evmConfigService.getCcipConfig(sourceChainId);

    // Encode proof data: (uint64 sourceChainId, uint256 gasLimit, bool allowOutOfOrderExecution)
    return encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [{ type: 'uint64' }, { type: 'uint256' }, { type: 'bool' }],
        },
      ],
      [[BigInt(sourceChainId), BigInt(ccipConfig.gasLimit), ccipConfig.allowOutOfOrderExecution]],
    );
  }

  getDeadlineBuffer(chainId: number): bigint {
    // Get CCIP configuration for the specified chain
    const ccipConfig = this.evmConfigService.getCcipConfig(chainId);
    return BigInt(ccipConfig.deadlineBuffer);
  }
}
