import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import Redis from 'ioredis';

import { SystemLoggerService } from '@/modules/logging';
import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';

import { ConfigModule } from '../config/config.module';
import { RedisConfigService } from '../config/services';

import { LeaderElectionService } from './leader-election.service';
import { RedisService } from './redis.service';
import { RedisCacheService } from './redis-cache.service';
import { RedisConnectionFactory } from './redis-connection.factory';

@Module({
  imports: [ConfigModule, LoggingModule, EventEmitterModule, OpenTelemetryModule],
  providers: [RedisService, RedisCacheService, LeaderElectionService, RedisConnectionFactory],
  exports: [RedisService, RedisCacheService, LeaderElectionService, RedisConnectionFactory],
})
export class RedisModule {
  static forRootRedisAsync(): DynamicModule {
    return {
      module: RedisModule,
      imports: [
        ConfigModule,
        LoggingModule,
        BullModule.forRootAsync({
          imports: [ConfigModule, LoggingModule],
          useFactory: (redisConfig: RedisConfigService, logger: SystemLoggerService) => {
            if (redisConfig.enableCluster) {
              const clusterNodes = redisConfig.clusterNodes || [
                { host: redisConfig.host, port: redisConfig.port },
              ];

              logger.log(
                `Initializing BullMQ with Redis cluster mode (${clusterNodes.length} nodes)`,
              );

              return {
                connection: new Redis.Cluster(clusterNodes, {
                  redisOptions: {
                    username: redisConfig.username,
                    password: redisConfig.password,
                    tls: redisConfig.tls,
                    maxRetriesPerRequest: null,
                  },
                  ...redisConfig.clusterOptions,
                }),
              };
            } else {
              logger.log(
                `Initializing BullMQ with Redis standalone mode at ${redisConfig.host}:${redisConfig.port}`,
              );

              return {
                connection: {
                  host: redisConfig.host,
                  port: redisConfig.port,
                  username: redisConfig.username,
                  password: redisConfig.password,
                  tls: redisConfig.tls,
                  maxRetriesPerRequest: null,
                  retryStrategy: (times: number) => {
                    logger.error(
                      'Failed to connect to Redis for BullMQ: ' +
                        JSON.stringify({
                          host: redisConfig.host,
                          port: redisConfig.port,
                          attempt: times,
                        }),
                    );
                    return Math.min(times * 50, 2000);
                  },
                },
              };
            }
          },
          inject: [RedisConfigService, SystemLoggerService],
        }),
      ],
      providers: [],
      exports: [BullModule],
    };
  }
}
