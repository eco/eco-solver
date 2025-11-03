import { Global, Module } from '@nestjs/common';

import { LoggerModule, Params as PinoParams } from 'nestjs-pino';

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
      useFactory: async (appConfig: AppConfigService): Promise<PinoParams> => {
        const loggerConfig = appConfig.getLoggerConfig();

        const pinoHttpConfig: PinoParams['pinoHttp'] = {
          ...loggerConfig.pinoConfig.pinoHttp,
          // Add custom serializers for sensitive data masking
          serializers: {
            req: (req: any) => ({
              id: req.id,
              method: req.method,
              url: req.url,
              params: maskSensitiveData(req.params, loggerConfig.maskKeywords),
              query: maskSensitiveData(req.query, loggerConfig.maskKeywords),
              body: maskSensitiveData(req.body, loggerConfig.maskKeywords),
            }),
            res: (res: any) => ({
              statusCode: res.statusCode,
            }),
          },
        };

        // Add pino-pretty transport if pretty logging is enabled
        if (loggerConfig.pretty) {
          pinoHttpConfig.transport = {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          };
        }

        return {
          pinoHttp: pinoHttpConfig,
        };
      },
    }),
  ],
  providers: [Logger, LoggerFactory, PinoOtelBridgeService],
  exports: [Logger, LoggerFactory, PinoOtelBridgeService],
})
export class LoggingModule {}
