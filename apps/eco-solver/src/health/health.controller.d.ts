import { HealthService } from './health.service';
import { EcoAnalyticsService } from '@eco-solver/analytics';
export declare class HealthController {
    private healthService;
    private readonly ecoAnalytics;
    private logger;
    constructor(healthService: HealthService, ecoAnalytics: EcoAnalyticsService);
    check(): Promise<import("@nestjs/terminus").HealthCheckResult>;
}
