import { Intent } from '@/common/interfaces/intent.interface';

export interface QueueService {
  addIntentToFulfillmentQueue(intent: Intent, strategy?: string): Promise<void>;
  addIntentToExecutionQueue(intent: Intent, walletAddress: string): Promise<void>;
  getQueueStatus(queueName: string): Promise<any>;
  addJob(queueName: string, data: any, options?: any): Promise<void>;
}