import { Intent } from '@/common/interfaces/intent.interface';
import { WalletType } from '@/modules/blockchain/evm/services/evm-wallet-manager.service';
import { TraceContext } from '@/modules/fulfillment/interfaces/fulfillment-job.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

export interface ExecutionJobData {
  strategy: FulfillmentStrategyName;
  intent: Intent;
  chainId: bigint;
  walletId?: WalletType;
  traceContext?: TraceContext;
}
