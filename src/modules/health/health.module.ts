import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseHealthIndicator } from '@nestjs/terminus';

import { DynamicConfigModule } from '../dynamic-config/dynamic-config.module';
import { RedisModule } from '../redis/redis.module';

import { BlockchainHealthIndicator } from './indicators/blockchain.health';
import { DynamicConfigHealthIndicator } from './indicators/dynamic-config.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [TerminusModule, RedisModule, DynamicConfigModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    MongooseHealthIndicator,
    RedisHealthIndicator,
    BlockchainHealthIndicator,
    DynamicConfigHealthIndicator,
  ],
  exports: [HealthService],
})
export class HealthModule {}
