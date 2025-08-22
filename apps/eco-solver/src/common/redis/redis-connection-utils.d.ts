import { RegisterQueueOptions } from '@nestjs/bullmq';
import * as Redis from 'ioredis';
import { QueueMetadata } from './constants';
import { RedisConfig } from '@libs/solver-config';
import { RedlockRedisClient } from '../../nest-redlock/nest-redlock.service';
export declare class RedisConnectionUtils {
    private static logger;
    static getRedisConnection(redisConfig: RedisConfig): Redis.Redis | Redis.Cluster;
    static getQueueOptions(queue: QueueMetadata, redisConfig: RedisConfig): RegisterQueueOptions;
    static getClientsForRedlock(redisConfig: RedisConfig): RedlockRedisClient[];
    private static isClusterConnection;
    private static getQueueOptionsForCluster;
    private static getClusterOptions;
}
