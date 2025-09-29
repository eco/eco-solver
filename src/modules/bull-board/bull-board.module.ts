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
  private static readOnlyMode: boolean | undefined;
  private bullBoardConfig: BullBoardConfigService;

  constructor(
    private readonly bullBoardConfigService?: BullBoardConfigService,
    private readonly loggerService?: SystemLoggerService,
    private readonly appConfigService?: AppConfigService,
  ) {
    if (bullBoardConfigService) {
      this.bullBoardConfig = bullBoardConfigService;
    }
  }

  static forRootAsync(): DynamicModule {
    return {
      module: BullBoardDashboardModule,
      imports: [
        ConfigModule,
        BullBoardModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (bullBoardConfig: BullBoardConfigService, appConfig: AppConfigService) => {
            // Store read-only mode from AppConfigService for use in createQueueFeatures
            BullBoardDashboardModule.readOnlyMode = appConfig.env !== 'development';

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
          inject: [BullBoardConfigService, AppConfigService],
        }),
        ...BullBoardDashboardModule.createQueueFeatures(),
      ],
      providers: [BasicAuthMiddleware],
    };
  }

  private static createQueueFeatures(): DynamicModule[] {
    // Use the stored readOnlyMode value from AppConfigService
    const readOnlyOptions = BullBoardDashboardModule.readOnlyMode
      ? { readOnlyMode: true }
      : undefined;

    const queueNames = [
      QueueNames.INTENT_FULFILLMENT,
      QueueNames.INTENT_EXECUTION,
      QueueNames.INTENT_WITHDRAWAL,
      QueueNames.BLOCKCHAIN_EVENTS,
    ];

    return queueNames.map((name) =>
      BullBoardModule.forFeature({
        name,
        adapter: BullMQAdapter,
        options: readOnlyOptions,
      }),
    );
  }

  onModuleInit() {
    if (this.bullBoardConfigService && this.loggerService && this.appConfigService) {
      if (this.bullBoardConfigService.isEnabled) {
        const readOnlyStatus =
          this.appConfigService.env !== 'development' ? ' (read-only mode)' : '';
        this.loggerService.log(
          `Bull Board dashboard enabled at /admin/queues (auth required: ${this.bullBoardConfigService.requiresAuth})${readOnlyStatus}`,
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
