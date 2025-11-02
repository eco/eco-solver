import { Global, Module } from '@nestjs/common';

import { LoggerModule } from 'nestjs-pino';

import { AppConfigService } from '@/modules/config/services/app-config.service';

import { maskSensitiveData } from './log-message.helper';

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
})
export class LoggingModule {}
