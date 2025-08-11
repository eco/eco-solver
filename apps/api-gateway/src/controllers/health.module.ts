import { HealthController } from "./health.controller"
import { HealthService } from "./health.service"
import { BalanceHealthIndicator } from "./indicators/balance.indicator"
import { EcoRedisHealthIndicator } from "./indicators/eco-redis.indicator"
import { GitCommitHealthIndicator } from "./indicators/git-commit.indicator"
import { MongoDBHealthIndicator } from "./indicators/mongodb.indicator"
import { TransactionModule } from "@libs/integrations"
import { Module } from "@nestjs/common"
import { TerminusModule } from "@nestjs/terminus"
import { RedisHealthModule } from "@liaoliaots/nestjs-redis-health"

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
