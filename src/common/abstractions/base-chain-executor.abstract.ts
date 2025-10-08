import { Injectable } from '@nestjs/common';

import { Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { UniversalAddress } from '@/common/types/universal-address.type';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
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

  abstract permit3(
    chainId: number,
    permitContract: UniversalAddress,
    owner: UniversalAddress,
    salt: Hex,
    deadline: number,
    timestamp: number,
    permits: Array<{
      modeOrExpiration: number;
      tokenKey: Hex;
      account: UniversalAddress;
      amountDelta: bigint;
    }>,
    merkleProof: Hex[],
    signature: Hex,
    walletType?: WalletType,
  ): Promise<Hex>;

  abstract fundFor(
    chainId: number,
    destination: bigint,
    routeHash: Hex,
    reward: {
      deadline: bigint;
      creator: UniversalAddress;
      prover: UniversalAddress;
      nativeAmount: bigint;
      tokens: Array<{ token: UniversalAddress; amount: bigint }>;
    },
    allowPartial: boolean,
    funder: UniversalAddress,
    permitContract: UniversalAddress,
    walletType?: WalletType,
  ): Promise<Hex>;
}
