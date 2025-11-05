import { Global, Module } from '@nestjs/common';

import { LoggerModule, Params as PinoParams } from 'nestjs-pino';

import { AppConfigService } from '@/modules/config/services/app-config.service';
import { OpenTelemetryConfigService } from '@/modules/config/services/opentelemetry-config.service';

import { maskSensitiveData } from './log-message.helper';
import { Logger } from './logger.service';
import { LoggerFactory } from './logger-factory.service';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfigService, OpenTelemetryConfigService],
      useFactory: async (
        appConfig: AppConfigService,
        otelConfig: OpenTelemetryConfigService,
      ): Promise<PinoParams> => {
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

        // Configure transports based on settings
        const otelLogExportEnabled = loggerConfig.otelLogExport?.enabled ?? otelConfig.enabled;

        // Build array of transports
        const transports: any[] = [];

        // Add pino-pretty transport if enabled (for human-readable output)
        if (loggerConfig.pretty) {
          transports.push({
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          });
        }

        // Add OpenTelemetry transport if enabled (for OTLP export)
        if (otelLogExportEnabled) {
          const baseEndpoint = (
            loggerConfig.otelLogExport?.endpoint || otelConfig.otlp.endpoint
          ).replace(/\/+$/, '');
          const logsEndpoint = baseEndpoint.includes('/v1/logs')
            ? baseEndpoint
            : `${baseEndpoint}/v1/logs`;

          const headers = {
            ...otelConfig.otlp.headers,
            ...loggerConfig.otelLogExport?.headers,
          };

          const resourceAttributes = {
            'service.name': otelConfig.serviceName,
            ...otelConfig.resource.attributes,
          };

          // Set environment variables for pino-opentelemetry-transport
          // The transport only reads from environment variables, not programmatic options
          process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = logsEndpoint;

          // Convert headers object to comma-separated format: "key1=value1,key2=value2"
          const headersString = Object.entries(headers)
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
          process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS = headersString;

          // Convert resource attributes to comma-separated format
          const resourceString = Object.entries(resourceAttributes)
            .map(([key, value]) => `${key}=${value}`)
            .join(',');
          process.env.OTEL_RESOURCE_ATTRIBUTES = resourceString;

          transports.push({
            target: 'pino-opentelemetry-transport',
            // No options needed - transport reads from environment variables
          });
        }

        // Apply transports if any are configured
        if (transports.length === 1) {
          pinoHttpConfig.transport = transports[0];
        } else if (transports.length > 1) {
          pinoHttpConfig.transport = {
            targets: transports,
          };
        }

        return {
          pinoHttp: pinoHttpConfig,
        };
      },
    }),
  ],
  providers: [Logger, LoggerFactory],
  exports: [Logger, LoggerFactory],
})
export class LoggingModule {}
