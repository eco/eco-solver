import { HealthCheckService } from '@nestjs/terminus';
import { BalanceHealthIndicator } from './indicators/balance.indicator';
import { EcoRedisHealthIndicator } from './indicators/eco-redis.indicator';
import { MongoDBHealthIndicator } from './indicators/mongodb.indicator';
import { GitCommitHealthIndicator } from './indicators/git-commit.indicator';
import { EcoAnalyticsService } from '@eco-solver/analytics';
export declare class HealthService {
    private readonly health;
    private readonly balanceIndicator;
    private readonly gitCommitHealthIndicator;
    private readonly mongoDBHealthIndicator;
    private readonly redisIndicator;
    private readonly ecoAnalytics;
    private logger;
    constructor(health: HealthCheckService, balanceIndicator: BalanceHealthIndicator, gitCommitHealthIndicator: GitCommitHealthIndicator, mongoDBHealthIndicator: MongoDBHealthIndicator, redisIndicator: EcoRedisHealthIndicator, ecoAnalytics: EcoAnalyticsService);
    checkHealth(): Promise<import("@nestjs/terminus").HealthCheckResult>;
}
