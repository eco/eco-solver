import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';

import { RequestIdMiddleware } from '@/common/middleware/request-id.middleware';
import { ApiModule } from '@/modules/api/api.module';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { BullBoardDashboardModule } from '@/modules/bull-board/bull-board.module';
import { ConfigModule } from '@/modules/config/config.module';
import { DatabaseConfigService } from '@/modules/config/services';
import { DataDogModule } from '@/modules/datadog/datadog.module';
import { EventsModule } from '@/modules/events/events.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { HealthModule } from '@/modules/health/health.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry';
import { QueueModule } from '@/modules/queue/queue.module';
import { RedisModule } from '@/modules/redis/redis.module';
import { WithdrawalModule } from '@/modules/withdrawal/withdrawal.module';
import { DynamicConfigModule } from '@/dynamic-config/dynamic-config.module';
import { ModuleRef } from '@nestjs/core';
import { ModuleRefProvider } from '@/common/services/module-ref-provider';

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
    RedisModule.forRootRedisAsync(),
    QueueModule,
    IntentsModule,
    BlockchainModule.forRootAsync(),
    FulfillmentModule,
    WithdrawalModule,
    BullBoardDashboardModule.forRootAsync(),
    ApiModule,
    HealthModule,
    DynamicConfigModule,
  ],
  providers: [
    {
      provide: 'ModuleRefProviderInit',
      inject: [ModuleRef],
      useFactory: (moduleRef: ModuleRef) => {
        ModuleRefProvider.setModuleRef(moduleRef);
        return true;
      },
    },
    Logger,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
