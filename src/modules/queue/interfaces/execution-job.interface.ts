import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

export interface ExecutionJobData {
  strategy: FulfillmentStrategyName;
  intent: Intent;
}