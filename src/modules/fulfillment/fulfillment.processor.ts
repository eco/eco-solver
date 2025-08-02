import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { Intent } from '@/common/interfaces/intent.interface';

export class FulfillmentProcessor extends WorkerHost {
  constructor(private fulfillmentService: FulfillmentService) {
    super();
  }

  async process(job: Job<Intent>) {
    if (job.name === 'process-intent') {
      console.log(`Processing intent ${job.data.intentId}`);
      await this.fulfillmentService.processIntent(job.data);
    }
  }
}