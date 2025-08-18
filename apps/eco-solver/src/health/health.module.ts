import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { RedisHealthModule } from '@liaoliaots/nestjs-redis-health'
import { TransactionModule } from '@eco-solver/transaction/transaction.module'
import { HealthController } from '@eco-solver/health/health.controller'
import { HealthService } from '@eco-solver/health/health.service'
import { BalanceHealthIndicator } from '@eco-solver/health/indicators/balance.indicator'
import { EcoRedisHealthIndicator } from '@eco-solver/health/indicators/eco-redis.indicator'
import { GitCommitHealthIndicator } from '@eco-solver/health/indicators/git-commit.indicator'
import { MongoDBHealthIndicator } from '@eco-solver/health/indicators/mongodb.indicator'
@Module({
  imports: [TransactionModule, RedisHealthModule, TerminusModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    BalanceHealthIndicator,
    EcoRedisHealthIndicator,
    GitCommitHealthIndicator,
    MongoDBHealthIndicator,
  ],
})
export class HealthModule {}
