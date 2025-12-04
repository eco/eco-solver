import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';

import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

import { AppModule } from '@/app.module';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import { SwaggerConfig } from '@/common/swagger';
import { AppConfigService, OpenTelemetryConfigService } from '@/modules/config/services';
import { HttpMetricsInterceptor, TraceInterceptor } from '@/modules/opentelemetry';

async function bootstrap() {
  // Determine environment for winston configuration
  const env = process.env.ENV || process.env.NODE_ENV || 'development';
  const isProduction = env !== 'development';

  // Configure winston transports
  const format = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ];

  // Create winston logger configuration
  const loggerConfig = {
    level: isProduction ? 'info' : 'debug',
    format,
    defaultMeta: {
      service: 'blockchain-intent-solver',
      environment: env,
    },
    transports,
    exitOnError: false,
  };

  // Create app with winston logger
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger(loggerConfig),
  });

  const logger = new Logger('Bootstrap');

  const appConfig = app.get(AppConfigService);
  const port = appConfig.port;

  // Security middleware
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: true, // Configure based on environment
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global exception filter
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new GlobalExceptionFilter(httpAdapter));

  // Global interceptors
  const interceptors = [];

  // OpenTelemetry interceptors (if enabled)
  const otelConfig = app.get(OpenTelemetryConfigService);
  if (otelConfig.enabled) {
    const httpMetricsInterceptor = app.get(HttpMetricsInterceptor);
    interceptors.push(httpMetricsInterceptor);
    logger.log('OpenTelemetry HTTP metrics interceptor enabled');

    const traceInterceptor = app.get(TraceInterceptor);
    interceptors.push(traceInterceptor);
    logger.log('OpenTelemetry trace interceptor enabled');
  }

  // Apply all interceptors
  if (interceptors.length > 0) {
    app.useGlobalInterceptors(...interceptors);
  }

  // Enable shutdown hooks
  app.enableShutdownHooks();

  // Setup Swagger documentation
  SwaggerConfig.setup(app);

  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Swagger documentation available at: ${await app.getUrl()}/api-docs`);
}

bootstrap();
