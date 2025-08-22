import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
export declare class GitCommitHealthIndicator extends HealthIndicator {
    private logger;
    constructor();
    gitCommit(): Promise<HealthIndicatorResult>;
    private getCommitHash;
    private getDependencyVersion;
}
