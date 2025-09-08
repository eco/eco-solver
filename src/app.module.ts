import { BullModule } from '@nestjs/bullmq';
import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

import { RequestIdMiddleware } from '@/common/middleware/request-id.middleware';
import { ApiModule } from '@/modules/api/api.module';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { BullBoardDashboardModule } from '@/modules/bull-board/bull-board.module';
import { ConfigModule } from '@/modules/config/config.module';
import { DatabaseConfigService, RedisConfigService } from '@/modules/config/services';
import { DataDogModule } from '@/modules/datadog/datadog.module';
import { EventsModule } from '@/modules/events/events.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { HealthModule } from '@/modules/health/health.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry';
import { QueueModule } from '@/modules/queue/queue.module';
// import { WithdrawalModule } from '@/modules/withdrawal/withdrawal.module';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    OpenTelemetryModule.forRootAsync(),
    DataDogModule.forRootAsync(),
    EventsModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
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
          maxRetriesPerRequest: null,
        },
      }),
      inject: [RedisConfigService],
    }),
    QueueModule,
    IntentsModule,
    BlockchainModule.forRootAsync(),
    FulfillmentModule,
    // WithdrawalModule,  // Temporarily disabled to fix BullMQ lock errors
    BullBoardDashboardModule.forRootAsync(),
    ApiModule,
    HealthModule,
  ],
  providers: [Logger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
