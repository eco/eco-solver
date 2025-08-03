import { WorkerHost } from '@nestjs/bullmq';
import { Processor } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';

import { FulfillmentJobData } from './interfaces/fulfillment-job.interface';

@Processor('intent-fulfillment')
export class FulfillmentProcessor extends WorkerHost {
  constructor(private fulfillmentService: FulfillmentService) {
    super();
  }

  async process(job: Job<FulfillmentJobData>) {
    if (job.name === 'process-intent') {
      console.log(
        `Processing intent ${job.data.intent.intentHash} with strategy ${job.data.strategy}`,
      );
      await this.fulfillmentService.processIntent(job.data.intent, job.data.strategy);
    }
  }
}
