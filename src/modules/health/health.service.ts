import { Injectable } from '@nestjs/common';
import { HealthCheckResult, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';

import { BlockchainHealthIndicator } from './indicators/blockchain.health';
import { DynamicConfigHealthIndicator } from './indicators/dynamic-config.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@Injectable()
export class HealthService {
  constructor(
    private health: HealthCheckService,
    private db: MongooseHealthIndicator,
    private redis: RedisHealthIndicator,
    private blockchain: BlockchainHealthIndicator,
    private dynamicConfig: DynamicConfigHealthIndicator,
  ) {}

  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('mongodb'),
      () => this.redis.isHealthy('redis'),
      () => this.blockchain.isHealthy('blockchain'),
      () => this.dynamicConfig.isHealthy('dynamic-config'),
    ]);
  }

  async liveness(): Promise<HealthCheckResult> {
    return this.health.check([() => ({ app: { status: 'up' } })]);
  }

  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('mongodb'),
      () => this.redis.isHealthy('redis'),
      () => this.blockchain.isHealthy('blockchain'),
      () => this.dynamicConfig.isHealthy('dynamic-config'),
    ]);
  }
}
