import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { EcoConfigService } from '@eco/infrastructure-config'
import { ConfigService } from '@eco/shared-config'
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino'
import { NestApplicationOptions, ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { BigIntToStringInterceptor } from '@eco/shared-interceptors'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, getNestParams())
  
  const configService = app.get(ConfigService)
  const config = configService.get()
  
  if (EcoConfigService.getStaticConfig().logger.usePino) {
    app.useLogger(app.get(Logger))
    app.useGlobalInterceptors(new LoggerErrorInterceptor())
  }

  app.setGlobalPrefix(config.api.prefix.replace('/', ''))

  if (config.api.cors.enabled) {
    app.enableCors({
      origin: config.api.cors.origin,
      credentials: true
    })
  }

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  )

  app.useGlobalInterceptors(new BigIntToStringInterceptor())

  addSwagger(app)

  app.enableShutdownHooks()
  
  const { host, port } = config.app
  await app.listen(port, host)
  
  const environment = configService.getEnvironment()
  console.log(`🚀 Application is running on: http://${host}:${port}${config.api.prefix}`)
  console.log(`📊 Environment: ${environment}`)
  console.log(`🗄️  Database: ${config.database.host}:${config.database.port}/${config.database.database}`)
  
  if (configService.isDevelopment() && (module as any).hot) {
    (module as any).hot.accept()
    (module as any).hot.dispose(() => app.close())
  }
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

bootstrap()
