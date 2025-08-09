import { WorkerHost } from '@nestjs/bullmq';
import { Processor } from '@nestjs/bullmq';

import { Job } from 'bullmq';

import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueSerializer } from '@/modules/queue/utils/queue-serializer';

import { FulfillmentJobData } from './interfaces/fulfillment-job.interface';

@Processor('intent-fulfillment')
export class FulfillmentProcessor extends WorkerHost {
  constructor(
    private fulfillmentService: FulfillmentService,
    private readonly logger: SystemLoggerService,
  ) {
    super();
    this.logger.setContext(FulfillmentProcessor.name);
  }

  async process(job: Job<string>) {
    if (job.name === 'process-intent') {
      const jobData = QueueSerializer.deserialize<FulfillmentJobData>(job.data);
      this.logger.log(
        `Processing intent ${jobData.intent.intentHash} with strategy ${jobData.strategy}`,
      );
      await this.fulfillmentService.processIntent(jobData.intent, jobData.strategy);
    }
  }
}
