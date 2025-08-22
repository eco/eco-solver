import { HealthIndicatorResult, MongooseHealthIndicator } from '@nestjs/terminus';
export declare class MongoDBHealthIndicator extends MongooseHealthIndicator {
    private logger;
    checkMongoDB(): Promise<HealthIndicatorResult>;
}
