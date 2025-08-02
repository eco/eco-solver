import { Injectable } from '@nestjs/common';

import { Intent } from '@/common/interfaces/intent.interface';

export interface FulfillmentResult {
  shouldExecute: boolean;
  reason?: string;
}

@Injectable()
export abstract class BaseFulfillment {
  abstract canFulfill(intent: Intent): Promise<FulfillmentResult>;
  abstract prepareFulfillmentData(intent: Intent): Promise<any>;
}
