import { Injectable, OnModuleInit } from '@nestjs/common';

import { StatsD } from 'hot-shots';

import { AppConfigService } from '@/modules/config/services/app-config.service';
import { DataDogConfigService } from '@/modules/config/services/datadog-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';

@Injectable()
export class DataDogService implements OnModuleInit {
  private statsD: StatsD;

  constructor(
    private readonly dataDogConfig: DataDogConfigService,
    private readonly logger: SystemLoggerService,
    private readonly appConfig?: AppConfigService,
  ) {
    this.logger.setContext(DataDogService.name);
  }

  onModuleInit() {
    // Initialize StatsD client for DataDog
    const globalTags = this.dataDogConfig.globalTags || { service: 'blockchain-intent-solver' };
    if (!globalTags?.env && this.appConfig) {
      globalTags.env = this.appConfig.env;
    }

    this.statsD = new StatsD({
      host: this.dataDogConfig.host,
      port: this.dataDogConfig.port,
      prefix: this.dataDogConfig.prefix,
      globalTags,
      mock: !this.dataDogConfig.enabled, // Use mock mode when DataDog is disabled
      errorHandler: (error) => {
        this.logger.error('DataDog StatsD error', error);
      },
    });

    if (this.dataDogConfig.enabled) {
      this.logger.log(
        `DataDog StatsD client initialized at ${this.dataDogConfig.host}:${this.dataDogConfig.port}`,
      );
    } else {
      this.logger.log('DataDog running in mock mode (metrics disabled)');
    }
  }

  // HTTP Metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    const tags = [`method:${method}`, `route:${route}`, `status_code:${statusCode}`];

    this.statsD.increment('http.requests.total', 1, tags);
    this.statsD.histogram('http.request.duration', duration, tags);

    if (statusCode >= 500) {
      this.statsD.increment('http.errors.5xx', 1, tags);
    } else if (statusCode >= 400) {
      this.statsD.increment('http.errors.4xx', 1, tags);
    }
  }

  // Queue Metrics
  recordQueueJob(
    queue: string,
    jobName: string,
    status: 'started' | 'completed' | 'failed',
    duration?: number,
  ) {
    const tags = [`queue:${queue}`, `job_name:${jobName}`, `status:${status}`];

    this.statsD.increment('queue.jobs.total', 1, tags);

    if (duration !== undefined && status !== 'started') {
      this.statsD.histogram('queue.job.duration', duration, tags);
    }

    if (status === 'failed') {
      this.statsD.increment('queue.jobs.failed', 1, tags);
    }
  }

  setQueueDepth(queue: string, depth: number) {
    this.statsD.gauge('queue.depth', depth, [`queue:${queue}`]);
  }

  // Intent Metrics
  recordIntent(
    status: 'submitted' | 'validated' | 'fulfilled' | 'failed',
    sourceChain: string,
    destinationChain: string,
    strategy: string,
    duration?: number,
    valueUsd?: number,
  ) {
    const tags = [
      `status:${status}`,
      `source_chain:${sourceChain}`,
      `destination_chain:${destinationChain}`,
      `strategy:${strategy}`,
    ];

    this.statsD.increment('intents.processed.total', 1, tags);

    if (duration !== undefined && status === 'fulfilled') {
      this.statsD.histogram('intent.processing.duration', duration, tags);
    }

    if (valueUsd !== undefined) {
      this.statsD.histogram('intent.value.usd', valueUsd, [
        `source_chain:${sourceChain}`,
        `destination_chain:${destinationChain}`,
      ]);
    }

    // Track success rate
    if (status === 'fulfilled') {
      this.statsD.increment('intents.successful', 1, tags);
    } else if (status === 'failed') {
      this.statsD.increment('intents.failed', 1, tags);
    }
  }

  // Blockchain RPC Metrics
  recordRpcCall(chain: string, method: string, status: 'success' | 'error', duration: number) {
    const tags = [`chain:${chain}`, `method:${method}`, `status:${status}`];

    this.statsD.increment('blockchain.rpc.calls.total', 1, tags);
    this.statsD.histogram('blockchain.rpc.duration', duration, tags);

    if (status === 'error') {
      this.statsD.increment('blockchain.rpc.errors', 1, tags);
    }
  }

  // Database Metrics
  recordDatabaseQuery(operation: string, collection: string, duration: number) {
    const tags = [`operation:${operation}`, `collection:${collection}`];

    this.statsD.histogram('database.query.duration', duration, tags);
    this.statsD.increment('database.queries.total', 1, tags);
  }

  // Error Metrics
  recordError(type: string, context: string) {
    this.statsD.increment('errors.total', 1, [`type:${type}`, `context:${context}`]);
  }

  // Custom Metrics
  increment(metric: string, value: number = 1, tags?: string[]) {
    this.statsD.increment(metric, value, tags);
  }

  gauge(metric: string, value: number, tags?: string[]) {
    this.statsD.gauge(metric, value, tags);
  }

  histogram(metric: string, value: number, tags?: string[]) {
    this.statsD.histogram(metric, value, tags);
  }

  timing(metric: string, value: number, tags?: string[]) {
    this.statsD.timing(metric, value, tags);
  }
}
