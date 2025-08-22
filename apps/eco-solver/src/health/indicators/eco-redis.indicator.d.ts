import { HealthIndicatorResult } from '@nestjs/terminus';
import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health';
import { EcoConfigService } from '@libs/solver-config';
export declare class EcoRedisHealthIndicator extends RedisHealthIndicator {
    private readonly configService;
    private logger;
    private readonly redis;
    constructor(configService: EcoConfigService);
    checkRedis(): Promise<HealthIndicatorResult>;
}
