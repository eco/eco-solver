import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Queue } from 'bullmq';

import { DataDogService } from '@/modules/datadog';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private depthMonitoringInterval: NodeJS.Timeout;

  constructor(
    @InjectQueue(QueueNames.INTENT_FULFILLMENT) private fulfillmentQueue: Queue,
    @InjectQueue(QueueNames.INTENT_EXECUTION) private executionQueue: Queue,
    private dataDogService: DataDogService,
  ) {}

  onModuleInit() {
    this.startQueueDepthMonitoring();
  }

  onModuleDestroy() {
    if (this.depthMonitoringInterval) {
      clearInterval(this.depthMonitoringInterval);
    }
  }

  private startQueueDepthMonitoring() {
    // Monitor queue depths every 30 seconds
    this.depthMonitoringInterval = setInterval(async () => {
      try {
        const [fulfillmentDepth, executionDepth] = await Promise.all([
          this.fulfillmentQueue.getWaitingCount(),
          this.executionQueue.getWaitingCount(),
        ]);

        this.dataDogService.setQueueDepth('fulfillment', fulfillmentDepth);
        this.dataDogService.setQueueDepth('execution', executionDepth);
      } catch (error) {
        // Silently catch errors to prevent interval from crashing
      }
    }, 30000);
  }
}
