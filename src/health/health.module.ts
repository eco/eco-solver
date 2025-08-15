import { Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { RedisHealthModule } from '@liaoliaots/nestjs-redis-health'
import { TransactionModule } from '@/transaction/transaction.module'
import { HealthController } from '@/health/health.controller'
import { HealthService } from '@/health/health.service'
import { BalanceHealthIndicator } from '@/health/indicators/balance.indicator'
import { EcoRedisHealthIndicator } from '@/health/indicators/eco-redis.indicator'
import { GitCommitHealthIndicator } from '@/health/indicators/git-commit.indicator'
import { MongoDBHealthIndicator } from '@/health/indicators/mongodb.indicator'
import { BalanceModule } from '@/balance/balance.module'
@Module({
  imports: [TransactionModule, BalanceModule, RedisHealthModule, TerminusModule],
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
