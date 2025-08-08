import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseHealthIndicator } from '@nestjs/terminus';

import { RedisModule } from '../redis/redis.module';

import { BlockchainHealthIndicator } from './indicators/blockchain.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [TerminusModule, RedisModule],
  controllers: [HealthController],
  providers: [
    HealthService,
    MongooseHealthIndicator,
    RedisHealthIndicator,
    BlockchainHealthIndicator,
  ],
  exports: [HealthService],
})
export class HealthModule {}
