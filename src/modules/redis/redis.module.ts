import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { SystemLoggerService } from '@/modules/logging';
import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';

import { ConfigModule } from '../config/config.module';
import { RedisConfigService } from '../config/services';

import { LeaderElectionService } from './leader-election.service';
import { RedisService } from './redis.service';
import { RedisCacheService } from './redis-cache.service';

@Module({
  imports: [ConfigModule, LoggingModule, EventEmitterModule, OpenTelemetryModule],
  providers: [RedisService, RedisCacheService, LeaderElectionService],
  exports: [RedisService, RedisCacheService, LeaderElectionService],
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
          useFactory: (redisConfig: RedisConfigService, logger: SystemLoggerService) => ({
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
          }),
          inject: [RedisConfigService, SystemLoggerService],
        }),
      ],
      providers: [],
      exports: [BullModule],
    };
  }
}
