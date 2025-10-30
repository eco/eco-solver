import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { RedisHealthModule } from '@liaoliaots/nestjs-redis-health'
import { TransactionModule } from '@/transaction/transaction.module'
import { LiquidityManagerModule } from '@/liquidity-manager/liquidity-manager.module'
import { HealthController } from '@/health/health.controller'
import { HealthService } from '@/health/health.service'
import { BalanceHealthIndicator } from '@/health/indicators/balance.indicator'
import { EcoRedisHealthIndicator } from '@/health/indicators/eco-redis.indicator'
import { GitCommitHealthIndicator } from '@/health/indicators/git-commit.indicator'
import { MongoDBHealthIndicator } from '@/health/indicators/mongodb.indicator'
import { RebalanceHealthIndicator } from '@/health/indicators/rebalance-health.indicator'
import { LoggingMetricsController } from '@/health/logging-metrics.controller'
@Module({
  imports: [TransactionModule, RedisHealthModule, TerminusModule, LiquidityManagerModule],
  controllers: [HealthController, LoggingMetricsController],
  providers: [
    HealthService,
    BalanceHealthIndicator,
    EcoRedisHealthIndicator,
    GitCommitHealthIndicator,
    MongoDBHealthIndicator,
    RebalanceHealthIndicator,
  ],
})
export class HealthModule {}
