import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ConfigModule } from '@/modules/config/config.module';
import { DatabaseConfigService, RedisConfigService } from '@/modules/config/services';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { IntentsModule } from '@/modules/intents/intents.module';
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
    BullModule.forRootAsync({
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
    FulfillmentModule,
    BlockchainModule,
  ],
})
export class AppModule {}
