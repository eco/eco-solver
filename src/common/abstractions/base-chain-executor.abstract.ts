import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

@Injectable()
export abstract class BaseChainExecutor {
  abstract fulfill(intent: Intent, walletId?: string): Promise<ExecutionResult>;
  abstract getBalance(address: string, chainId: number): Promise<bigint>;
  abstract isTransactionConfirmed(txHash: string, chainId: number): Promise<boolean>;
}
