import { Intent } from '@/common/interfaces/intent.interface';

export interface FulfillmentJobData {
  intent: Intent;
  strategy: string;
}
