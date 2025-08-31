import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

export interface FulfillmentJobData {
  intent: Intent;
  chainId: number;
  strategy: FulfillmentStrategyName;
  traceContext?: TraceContext;
}
