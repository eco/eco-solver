import { Intent } from '@/modules/intents/interfaces/intent.interface';

export interface FulfillmentJobData {
  intent: Intent;
  strategy: string;
}