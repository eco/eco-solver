import { Injectable } from '@nestjs/common';

import { ChainConfig } from '@/common/interfaces/chain-config.interface';
import { Intent } from '@/common/interfaces/intent.interface';

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

@Injectable()
export abstract class BaseChainExecutor {
  protected config: ChainConfig;

  constructor(config: ChainConfig) {
    this.config = config;
  }

  abstract execute(intent: Intent, walletId?: string): Promise<ExecutionResult>;
  abstract getBalance(address: string, chainId: number): Promise<bigint>;
  abstract isTransactionConfirmed(txHash: string, chainId: number): Promise<boolean>;
}
