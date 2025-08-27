import { WorkerHost } from '@nestjs/bullmq';
import { Processor } from '@nestjs/bullmq';
import { Optional } from '@nestjs/common';

import { Job } from 'bullmq';

import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueTracingService } from '@/modules/opentelemetry/queue-tracing.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';
import { QueueSerializer } from '@/modules/queue/utils/queue-serializer';

import { FulfillmentJobData } from './interfaces/fulfillment-job.interface';

@Processor(QueueNames.INTENT_FULFILLMENT)
export class FulfillmentProcessor extends WorkerHost {
  constructor(
    private fulfillmentService: FulfillmentService,
    private readonly logger: SystemLoggerService,
    @Optional() private readonly queueTracing?: QueueTracingService,
  ) {
    super();
    this.logger.setContext(FulfillmentProcessor.name);
  }

  async process(job: Job<string>) {
    if (job.name === 'process-intent') {
      const processFn = async (j: Job<string>) => {
        const jobData = QueueSerializer.deserialize<FulfillmentJobData>(j.data);
        this.logger.log(
          `Processing intent ${jobData.intent.intentHash} with strategy ${jobData.strategy}`,
        );
        await this.fulfillmentService.processIntent(jobData.intent, jobData.strategy);
      };

      if (this.queueTracing) {
        return this.queueTracing.wrapProcessor(
          'FulfillmentProcessor',
          QueueNames.INTENT_FULFILLMENT,
          processFn,
        )(job);
      } else {
        return processFn(job);
      }
    }
  }
}
