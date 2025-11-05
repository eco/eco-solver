import { Injectable } from '@nestjs/common';

import { Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import {
  FundForParams,
  Permit3Params,
} from '@/modules/blockchain/interfaces/executor-params.interface';
import { BatchWithdrawData } from '@/modules/withdrawal/interfaces/withdrawal-job.interface';

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

  abstract executeBatchWithdraw(
    chainId: bigint,
    withdrawalData: BatchWithdrawData,
    walletId?: string,
  ): Promise<string>;

  abstract permit3(params: Permit3Params): Promise<Hex>;

  abstract fundFor(params: FundForParams): Promise<Hex>;

  abstract fundForWithPermit3(
    permit3Params: Permit3Params,
    fundForCalls: FundForParams[],
  ): Promise<Hex>;
}
