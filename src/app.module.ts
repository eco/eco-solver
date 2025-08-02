import { BullMQModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ConfigModule } from '@/modules/config/config.module';
import { DatabaseConfigService, RedisConfigService } from '@/modules/config/services';
import { ExecutionModule } from '@/modules/execution/execution.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { OnChainListenerModule } from '@/modules/on-chain-listener/on-chain-listener.module';
import { QueueModule } from '@/modules/queue/queue.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (databaseConfig: DatabaseConfigService) => ({
        uri: databaseConfig.uri,
      }),
      inject: [DatabaseConfigService],
    }),
    BullMQModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (redisConfig: RedisConfigService) => ({
        connection: {
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
        },
      }),
      inject: [RedisConfigService],
    }),
    QueueModule,
    IntentsModule,
    OnChainListenerModule,
    FulfillmentModule,
    ExecutionModule,
  ],
})
export class AppModule {}
