import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
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

  abstract getWalletAddress(
    walletType: WalletType,
    chainId: bigint | number,
  ): Promise<UniversalAddress>;

  abstract isTransactionConfirmed(txHash: string, chainId: number): Promise<boolean>;
}
