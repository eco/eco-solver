import { HealthCheckService } from '@nestjs/terminus'
import { BalanceHealthIndicator } from "./indicators/balance.indicator"
import { EcoRedisHealthIndicator } from "./indicators/eco-redis.indicator"
import { GitCommitHealthIndicator } from "./indicators/git-commit.indicator"
import { MongoDBHealthIndicator } from "./indicators/mongodb.indicator"
import { EcoAnalyticsService } from "@libs/integrations"
import { Injectable, Logger } from "@nestjs/common"
import { EcoLogMessage } from "@libs/shared"

@Injectable()
export class HealthService {
  private logger = new Logger(HealthService.name)

  constructor(
    private readonly health: HealthCheckService,
    private readonly balanceIndicator: BalanceHealthIndicator,
    private readonly gitCommitHealthIndicator: GitCommitHealthIndicator,
    private readonly mongoDBHealthIndicator: MongoDBHealthIndicator,
    private readonly redisIndicator: EcoRedisHealthIndicator,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  async checkHealth() {
    const healthCheck = await this.health.check([
      () => this.gitCommitHealthIndicator.gitCommit(),
      () => this.redisIndicator.checkRedis(),
      () => this.mongoDBHealthIndicator.checkMongoDB(),
      () => this.balanceIndicator.checkBalances(),
    ])
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: `HealthService.checkHealth()`,
        properties: {
          healthCheck: healthCheck,
        },
      }),
    )
    return healthCheck
  }
}
