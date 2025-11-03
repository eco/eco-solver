import { Global, Module } from '@nestjs/common';

import { LoggerModule, PinoLogger } from 'nestjs-pino';

import { AppConfigService } from '@/modules/config/services/app-config.service';

import { maskSensitiveData } from './log-message.helper';
import { Logger } from './logger.service';
import { LoggerFactory } from './logger-factory.service';
import { PinoOtelBridgeService } from './pino-otel-bridge.service';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: async (appConfig: AppConfigService) => {
        const loggerConfig = appConfig.getLoggerConfig();

        return {
          pinoHttp: {
            ...loggerConfig.pinoConfig.pinoHttp,
            // Add custom serializers for sensitive data masking
            serializers: {
              req: (req: any) => {
                const masked = {
                  id: req.id,
                  method: req.method,
                  url: req.url,
                  params: maskSensitiveData(req.params, loggerConfig.maskKeywords),
                  query: maskSensitiveData(req.query, loggerConfig.maskKeywords),
                  body: maskSensitiveData(req.body, loggerConfig.maskKeywords),
                };
                return masked;
              },
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
            },
          },
        };
      },
    }),
  ],
  providers: [
    // Override PinoLogger with our custom Logger for structured logging
    {
      provide: PinoLogger,
      useClass: Logger,
    },
    LoggerFactory,
    PinoOtelBridgeService,
  ],
  exports: [Logger, LoggerFactory, PinoOtelBridgeService],
})
export class LoggingModule {}
