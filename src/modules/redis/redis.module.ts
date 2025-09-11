import { Module } from '@nestjs/common';

import { LoggingModule } from '@/modules/logging/logging.module';

import { ConfigModule } from '../config/config.module';

import { RedisService } from './redis.service';
import { RedisCacheService } from './redis-cache.service';

@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [RedisService, RedisCacheService],
  exports: [RedisService, RedisCacheService],
})
export class RedisModule {}
