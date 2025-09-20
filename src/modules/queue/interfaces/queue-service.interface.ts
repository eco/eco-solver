import { Intent } from '@/common/interfaces/intent.interface';
import { BlockchainEventJob } from '@/modules/blockchain/interfaces/blockchain-event-job.interface';
import { FulfillmentStrategyName } from '@/modules/fulfillment/types/strategy-name.type';
import { ExecutionJobData } from '@/modules/queue/interfaces/execution-job.interface';

export interface IQueueService {
  addIntentToFulfillmentQueue(intent: Intent, strategy?: FulfillmentStrategyName): Promise<void>;
  addIntentToExecutionQueue(jobData: ExecutionJobData): Promise<void>;
  addBlockchainEvent(job: BlockchainEventJob): Promise<void>;
  getQueueStatus(queueName: string): Promise<any>;
  addJob(queueName: string, data: any, options?: any): Promise<void>;
}
