import { Intent } from '@/common/interfaces/intent.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';

export interface QueueService {
  addIntentToFulfillmentQueue(intent: Intent, strategy?: FulfillmentStrategyName): Promise<void>;
  addIntentToExecutionQueue(intent: Intent, strategy: FulfillmentStrategyName): Promise<void>;
  getQueueStatus(queueName: string): Promise<any>;
  addJob(queueName: string, data: any, options?: any): Promise<void>;
}
