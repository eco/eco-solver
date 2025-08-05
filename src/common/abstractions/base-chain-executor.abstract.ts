import { Injectable } from '@nestjs/common';

import { Address } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

@Injectable()
export abstract class BaseChainExecutor {
  abstract fulfill(intent: Intent, walletId?: WalletType): Promise<ExecutionResult>;

  abstract getBalance(address: string, chainId: number): Promise<bigint>;

  abstract getWalletAddress(walletType: WalletType, chainId: bigint | number): Promise<Address>;

  abstract isTransactionConfirmed(txHash: string, chainId: number): Promise<boolean>;
}
