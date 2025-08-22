import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NestExpressApplication } from '@nestjs/platform-express'
import { EcoConfigService } from '@libs/solver-config'
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino'
import { NestApplicationOptions, ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { BigIntToStringInterceptor } from '@eco-solver/interceptors/big-int.interceptor'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, getNestParams())
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

  //add swagger
  addSwagger(app)

  // Starts listening for shutdown hooks
  app.enableShutdownHooks()
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

bootstrap()
