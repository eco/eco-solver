import { AppModule } from '@/app.module'
import { BigIntToStringInterceptor } from '@/interceptors/big-int.interceptor'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { EcoConfigService } from './eco-configs/eco-config.service'
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino'
import { ModuleRef, NestFactory } from '@nestjs/core'
import { ModuleRefProvider } from '@/common/services/module-ref-provider'
import { NestApplicationOptions, ValidationPipe } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import * as express from 'express'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, getNestParams())
  ModuleRefProvider.setModuleRef(app.get(ModuleRef))

  if (EcoConfigService.getStaticConfig().logger.usePino) {
    app.useLogger(app.get(Logger))
    app.useGlobalInterceptors(new LoggerErrorInterceptor())
  }

  //add dto validations, enable transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Enables DTO transformation for incoming requests
    }),
  )

  //change all bigints to strings in the controller responses
  app.useGlobalInterceptors(new BigIntToStringInterceptor())

  // Register process-level safety nets for uncaught errors
  setupProcessHandlers(app)

  //add swagger
  addSwagger(app)

  // Starts listening for shutdown hooks
  app.enableShutdownHooks()

  // Raise body size limits (example: 10 MB)
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ limit: '10mb', extended: true }))

  await app.listen(3000)
}

function getNestParams(): NestApplicationOptions {
  let params = {
    cors: true,
    rawBody: true, //needed for AlchemyAuthMiddleware webhook verification
  }
  if (EcoConfigService.getStaticConfig().logger.usePino) {
    params = {
      ...params,
      ...{
        bufferLogs: true,
      },
    }
  }

  return params
}

function addSwagger(app: NestExpressApplication) {
  const config = new DocumentBuilder()
    .setTitle('Solver API')
    .setDescription('The api for the solver queries')
    .setVersion('0.1')
    .addTag('solver')
    .build()
  const documentFactory = () => SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api', app, documentFactory)
}

function setupProcessHandlers(app: NestExpressApplication) {
  const usePino = EcoConfigService.getStaticConfig().logger.usePino
  const pinoLogger = usePino ? app.get(Logger) : null
  let isShuttingDown = false

  const logError = (message: string, error: unknown) => {
    if (pinoLogger) {
      // Log with pino if available
      const asError =
        error instanceof Error ? { msg: message, err: error } : { msg: message, err: String(error) }
      pinoLogger.error(asError)
    } else {
      // Fallback to console
      // eslint-disable-next-line no-console
      console.error(message, error)
    }
  }

  const drainStreams = async () => {
    try {
      await Promise.all([
        new Promise((resolve) => process.stdout.write('', () => resolve(null))),
        new Promise((resolve) => process.stderr.write('', () => resolve(null))),
      ])
    } catch {
      // ignore
    }
  }

  const flushLogger = async () => {
    try {
      const pinoLike: any = (pinoLogger as any)?.logger ?? (pinoLogger as any)
      if (pinoLike && typeof pinoLike.flush === 'function') {
        pinoLike.flush()
      }
    } catch {
      // ignore
    }
    await drainStreams()
  }

  const shutdown = async (reason: string, error?: unknown, exitCode: number = 1) => {
    if (isShuttingDown) return
    isShuttingDown = true
    try {
      if (error !== undefined) {
        logError(`[process] ${reason}`, error)
      } else if (pinoLogger) {
        pinoLogger.warn({ msg: `[process] ${reason}` })
      } else {
        // eslint-disable-next-line no-console
        console.warn(`[process] ${reason}`)
      }
      await app.close()
    } catch (closeError) {
      logError('[process] error during graceful shutdown', closeError)
    } finally {
      // ensure logs are flushed before exiting
      // We explicitly exit the process after closing Nest to avoid the app
      // lingering in an undefined state or keeping event loops alive due to
      // open handles. Exiting ensures k8s/systemd can restart us cleanly.
      await flushLogger()
      process.exit(exitCode)
    }
  }

  process.on('uncaughtException', (error: Error) => {
    void shutdown('uncaughtException', error)
  })

  process.on('unhandledRejection', (reason: unknown) => {
    void shutdown('unhandledRejection', reason)
  })

  // Graceful signal handling
  const handleSignal = (signal: NodeJS.Signals) => {
    void shutdown(`received ${signal}`, undefined, 0)
  }
  process.on('SIGTERM', handleSignal)
  process.on('SIGINT', handleSignal)
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[bootstrap] failed to start application', err)
  process.exit(1)
})
