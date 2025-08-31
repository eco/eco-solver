import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { BlockchainConfigService } from '@/modules/config/services';

@Injectable()
export abstract class BaseProver implements OnModuleInit {
  abstract readonly type: string;
  protected blockchainReaderService: BlockchainReaderService;

  constructor(
    protected readonly blockchainConfigService: BlockchainConfigService,
    protected readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    // Lazy load BlockchainReaderService to avoid circular dependency
    this.blockchainReaderService = await this.moduleRef.get(BlockchainReaderService, {
      strict: false,
    });
  }

  abstract generateProof(intent: Intent): Promise<Hex>;
  abstract getFee(intent: Intent, claimant?: Address): Promise<bigint>;
  abstract getDeadlineBuffer(): bigint;

  getContractAddress(chainId: number): Address | undefined {
    return this.blockchainConfigService.getProverAddress(chainId, this.type as 'hyper' | 'metalayer') as Address | undefined;
  }

  isSupported(chainId: number): boolean {
    return Boolean(this.getContractAddress(chainId));
  }
}
