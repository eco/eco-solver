import { Global, Module } from '@nestjs/common';

import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

import { AppConfigService } from '@/modules/config/services/app-config.service';

import { LoggerService, SystemLoggerService } from './logger.service';
import { createWinstonConfig } from './winston.config';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: (appConfig: AppConfigService) => {
        const transports: winston.transport[] = [
          new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
          }),
        ];

        return createWinstonConfig(appConfig, transports);
      },
      inject: [AppConfigService],
    }),
  ],
  providers: [LoggerService, SystemLoggerService],
  exports: [LoggerService, SystemLoggerService],
})
export class LoggingModule {}
