import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';

import { ConfigModule } from '../config/config.module';

import { LeaderElectionService } from './leader-election.service';
import { RedisService } from './redis.service';
import { RedisCacheService } from './redis-cache.service';

@Module({
  imports: [ConfigModule, LoggingModule, EventEmitterModule, OpenTelemetryModule],
  providers: [RedisService, RedisCacheService, LeaderElectionService],
  exports: [RedisService, RedisCacheService, LeaderElectionService],
})
export class RedisModule {}
