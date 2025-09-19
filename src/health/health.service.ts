import { Injectable } from '@nestjs/common'

import { HealthCheckService } from '@nestjs/terminus'

import { BalanceHealthIndicator } from './indicators/balance.indicator'
import { EcoRedisHealthIndicator } from './indicators/eco-redis.indicator'
import { MongoDBHealthIndicator } from './indicators/mongodb.indicator'
import { RebalanceHealthIndicator } from './indicators/rebalance-health.indicator'
import { HealthOperationLogger } from '@/common/logging/loggers'
import { GitCommitHealthIndicator } from './indicators/git-commit.indicator'
import { EcoAnalyticsService } from '@/analytics'

@Injectable()
export class HealthService {
  private logger = new HealthOperationLogger('HealthService')

  constructor(
    private readonly health: HealthCheckService,
    private readonly balanceIndicator: BalanceHealthIndicator,
    private readonly gitCommitHealthIndicator: GitCommitHealthIndicator,
    private readonly mongoDBHealthIndicator: MongoDBHealthIndicator,
    private readonly redisIndicator: EcoRedisHealthIndicator,
    private readonly rebalanceHealthIndicator: RebalanceHealthIndicator,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  async checkHealth() {
    const healthCheck = await this.health.check([
      () => this.gitCommitHealthIndicator.gitCommit(),
      () => this.redisIndicator.checkRedis(),
      () => this.mongoDBHealthIndicator.checkMongoDB(),
      () => this.balanceIndicator.checkBalances(),
      () => this.rebalanceHealthIndicator.checkRebalancingHealth(),
    ])
    this.logger.log(
      {
        healthCheck: 'comprehensive',
        status: healthCheck.status,
        dependencies: Object.keys(healthCheck.details || {}),
      },
      'Comprehensive health check completed',
      {
        healthCheck: healthCheck,
      },
    )
    return healthCheck
  }
}
