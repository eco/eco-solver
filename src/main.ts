import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import helmet from 'helmet';
import { Logger as PinoLogger, LoggerErrorInterceptor } from 'nestjs-pino';

import { AppModule } from '@/app.module';
import { GlobalExceptionFilter } from '@/common/filters/global-exception.filter';
import { SwaggerConfig } from '@/common/swagger';
import {
  AppConfigService,
  DataDogConfigService,
  OpenTelemetryConfigService,
} from '@/modules/config/services';
import { DataDogInterceptor } from '@/modules/datadog';
import { TraceInterceptor } from '@/modules/opentelemetry';

async function bootstrap() {
  // Create app with Pino logger
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Replace default logger with Pino
  app.useLogger(app.get(PinoLogger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  const logger = new Logger('Bootstrap');

  const appConfig = app.get(AppConfigService);
  const port = appConfig.port;

  // Security middleware
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: true,
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

  // Global exception filter - get it from DI container to ensure proper logger injection
  const exceptionFilter = app.get(GlobalExceptionFilter);
  app.useGlobalFilters(exceptionFilter);

  // Global interceptors
  const interceptors = [];

  // DataDog metrics interceptor (if enabled)
  const dataDogConfig = app.get(DataDogConfigService);
  if (dataDogConfig.enabled) {
    const dataDogInterceptor = app.get(DataDogInterceptor);
    interceptors.push(dataDogInterceptor);
    logger.log('DataDog metrics interceptor enabled');
  }

  // OpenTelemetry trace interceptor (if enabled)
  const otelConfig = app.get(OpenTelemetryConfigService);
  if (otelConfig.enabled) {
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

  // Setup graceful shutdown handlers
  setupProcessHandlers(app);

  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Swagger documentation available at: ${await app.getUrl()}/api-docs`);
}

/**
 * Setup process handlers for graceful shutdown
 */
function setupProcessHandlers(app: INestApplication) {
  const pinoLogger = app.get(PinoLogger);
  let isShuttingDown = false;

  const logError = (message: string, error: unknown) => {
    const asError =
      error instanceof Error ? { msg: message, err: error } : { msg: message, err: String(error) };
    pinoLogger.error(asError);
  };

  const drainStreams = async () => {
    try {
      await Promise.all([
        new Promise((resolve) => process.stdout.write('', () => resolve(null))),
        new Promise((resolve) => process.stderr.write('', () => resolve(null))),
      ]);
    } catch {
      // ignore
    }
  };

  const flushLogger = async () => {
    try {
      const pinoLike: any = (pinoLogger as any)?.logger ?? (pinoLogger as any);
      if (pinoLike && typeof pinoLike.flush === 'function') {
        pinoLike.flush();
      }
    } catch {
      // ignore
    }
    await drainStreams();
  };

  const shutdown = async (reason: string, error?: unknown, exitCode: number = 1) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    try {
      if (error !== undefined) {
        logError(`[process] ${reason}`, error);
      } else {
        pinoLogger.warn({ msg: `[process] ${reason}` });
      }
      await app.close();
    } catch (closeError) {
      logError('[process] error during graceful shutdown', closeError);
    } finally {
      // Ensure logs are flushed before exiting
      await flushLogger();
      process.exit(exitCode);
    }
  };

  process.on('uncaughtException', (error: Error) => {
    void shutdown('uncaughtException', error);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    void shutdown('unhandledRejection', reason);
  });

  // Graceful signal handling
  const handleSignal = (signal: NodeJS.Signals) => {
    void shutdown(`received ${signal}`, undefined, 0);
  };
  process.on('SIGTERM', handleSignal);
  process.on('SIGINT', handleSignal);
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed to start application', err);
  process.exit(1);
});
