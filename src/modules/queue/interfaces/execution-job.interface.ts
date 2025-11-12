import { Address, Hex } from 'viem';

import { Intent } from '@/common/interfaces/intent.interface';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

export interface RhinestonePayload {
  claimTo: Address; // Router address for CLAIM transaction
  claimData: Hex;
  claimValue: bigint;
  fillTo: Address; // Router address for FILL transaction
  fillData: Hex;
  fillValue: bigint;
}

// Execution job data - clean interface for all strategies
export interface ExecutionJobData {
  strategy: FulfillmentStrategyName;
  intent: Intent;
  chainId: bigint;
  walletId?: WalletType;
}
