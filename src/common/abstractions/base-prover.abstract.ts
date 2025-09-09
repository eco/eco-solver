import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { TProverType } from '@/common/interfaces/prover.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { BlockchainReaderService } from '@/modules/blockchain/blockchain-reader.service';
import { BlockchainConfigService } from '@/modules/config/services';

@Injectable()
export abstract class BaseProver implements OnModuleInit {
  abstract readonly type: string;
  protected blockchainReaderService!: BlockchainReaderService; // Will be initialized in onModuleInit

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

  abstract getDeadlineBuffer(): bigint;

  getContractAddress(chainId: number): UniversalAddress | undefined {
    return this.blockchainConfigService.getProverAddress(chainId, this.type as TProverType);
  }

  isSupported(chainId: number): boolean {
    return Boolean(this.getContractAddress(chainId));
  }

  async getFee(intent: Intent, claimant?: UniversalAddress): Promise<bigint> {
    const localProver = this.getContractAddress(Number(intent.destination));
    if (!localProver) {
      throw new Error(`No prover contract address found for chain ${intent.destination}`);
    }

    // Fetch fee from the source chain where the intent originates
    return this.blockchainReaderService.fetchProverFee(
      intent.destination,
      intent,
      localProver,
      await this.generateProof(intent),
      claimant,
    );
  }
}
