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

  abstract execute(intent: Intent): Promise<ExecutionResult>;
  abstract getBalance(address: string): Promise<bigint>;
  abstract isTransactionConfirmed(txHash: string): Promise<boolean>;
}
