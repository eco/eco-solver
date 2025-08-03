import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

export interface FulfillmentJobData {
  intent: Intent;
  strategy: FulfillmentStrategyName;
}
