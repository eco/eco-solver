import { Intent } from '@/common/interfaces/intent.interface';

export interface WithdrawalJobData {
  chainId: bigint;
  intents: Intent[];
  walletId?: string;
}

export interface BatchWithdrawData {
  destinations: bigint[];
  routeHashes: string[];
  rewards: {
    deadline: bigint;
    creator: string;
    prover: string;
    nativeAmount: bigint;
    tokens: {
      token: string;
      amount: bigint;
    }[];
  }[];
}
