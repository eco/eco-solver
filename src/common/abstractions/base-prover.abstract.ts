import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { EvmConfigService } from '@/modules/config/services';

@Injectable()
export abstract class BaseProver implements OnModuleInit {
  abstract readonly type: string;
  protected blockchainReaderService: BlockchainReaderService;

  constructor(
    protected readonly evmConfigService: EvmConfigService,
    protected readonly moduleRef: ModuleRef,
  ) {}

  async onModuleInit() {
    // Lazy load BlockchainReaderService to avoid circular dependency
    this.blockchainReaderService = await this.moduleRef.get(BlockchainReaderService, {
      strict: false,
    });
  }

  abstract getMessageData(intent: Intent): Promise<Hex>;
  abstract getFee(intent: Intent, claimant?: Address): Promise<bigint>;

  getContractAddress(chainId: number): Address | undefined {
    const chainConfig = this.evmConfigService.getChain(chainId);
    return chainConfig?.provers[this.type];
  }

  isSupported(chainId: number): boolean {
    return Boolean(this.getContractAddress(chainId));
  }
}
