import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';

import { ConfigModule } from '../config/config.module';

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
          imports: [RedisModule],
          useFactory: (connectionFactory: RedisConnectionFactory) => {
            return {
              connection: connectionFactory.createConnection(),
            };
          },
          inject: [RedisConnectionFactory],
        }),
      ],
      providers: [],
      exports: [BullModule],
    };
  }
}
