import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';

import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

import { AppModule } from '@/app.module';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import { AppConfigService, DataDogConfigService } from '@/modules/config/services';
import { DataDogInterceptor } from '@/modules/datadog';

async function bootstrap() {
  // Determine environment for winston configuration
  const env = process.env.ENV || process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

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

  // Global DataDog metrics interceptor (if enabled)
  const dataDogConfig = app.get(DataDogConfigService);
  if (dataDogConfig.enabled) {
    const dataDogInterceptor = app.get(DataDogInterceptor);
    app.useGlobalInterceptors(dataDogInterceptor);
    logger.log('DataDog metrics interceptor enabled');
  }

  // Enable shutdown hooks
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();
