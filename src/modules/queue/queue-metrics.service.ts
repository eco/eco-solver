import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Queue } from 'bullmq';

import { DataDogService } from '@/modules/datadog';

@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private depthMonitoringInterval: NodeJS.Timeout;

  constructor(
    @InjectQueue('intent-fulfillment') private fulfillmentQueue: Queue,
    @InjectQueue('blockchain-execution') private executionQueue: Queue,
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
