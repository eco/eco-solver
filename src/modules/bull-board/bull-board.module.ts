import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common';

import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';

import { ConfigModule } from '@/modules/config/config.module';
import { AppConfigService } from '@/modules/config/services/app-config.service';
import { BullBoardConfigService } from '@/modules/config/services/bull-board-config.service';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

import { BasicAuthMiddleware } from './middleware/basic-auth.middleware';
import { createBullBoardAdapter } from './authenticated-express-adapter';

@Module({})
export class BullBoardDashboardModule implements NestModule, OnModuleInit {
  private bullBoardConfig: BullBoardConfigService;

  static forRootAsync(): DynamicModule {
    return {
      module: BullBoardDashboardModule,
      imports: [
        ConfigModule,
        BullBoardModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (bullBoardConfig: BullBoardConfigService) => {
            // Check if Bull Board should be enabled
            if (!bullBoardConfig.isEnabled) {
              // Return minimal config that won't create routes
              return {
                route: '/admin/queues',
                adapter: ExpressAdapter,
                queues: [],
              };
            }

            // Create adapter with or without authentication based on config
            const AdapterClass = bullBoardConfig.requiresAuth
              ? createBullBoardAdapter(bullBoardConfig)
              : ExpressAdapter;

            return {
              route: '/admin/queues',
              adapter: AdapterClass,
            };
          },
          inject: [BullBoardConfigService],
        }),
        BullBoardModule.forFeature({
          name: QueueNames.INTENT_FULFILLMENT,
          adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
          name: QueueNames.INTENT_EXECUTION,
          adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
          name: QueueNames.INTENT_WITHDRAWAL,
          adapter: BullMQAdapter,
        }),
      ],
      providers: [BasicAuthMiddleware],
    };
  }

  constructor(
    private readonly bullBoardConfigService?: BullBoardConfigService,
    private readonly loggerService?: SystemLoggerService,
    private readonly appConfigService?: AppConfigService,
  ) {
    if (bullBoardConfigService) {
      this.bullBoardConfig = bullBoardConfigService;
    }
  }

  onModuleInit() {
    if (this.bullBoardConfigService && this.loggerService) {
      if (this.bullBoardConfigService.isEnabled) {
        this.loggerService.log(
          `Bull Board dashboard enabled at /admin/queues (auth required: ${this.bullBoardConfigService.requiresAuth})`,
        );
      } else {
        this.loggerService.log('Bull Board dashboard disabled');
      }
    }
  }

  configure(consumer: MiddlewareConsumer) {
    // Apply middleware if needed (though authentication is now handled by the adapter)
    if (this.bullBoardConfigService?.requiresAuth) {
      consumer.apply(BasicAuthMiddleware).forRoutes('/admin/queues', '/admin/queues/*');
    }
  }
}
