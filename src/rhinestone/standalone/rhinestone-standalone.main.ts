import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { RhinestoneStandaloneModule } from './rhinestone-standalone.module'

async function bootstrap() {
  const logger = new Logger('RhinestoneStandalone')

  try {
    const app = await NestFactory.create(RhinestoneStandaloneModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    })

    const port = process.env.PORT || 4000
    await app.listen(port)

    logger.log(`🚀 Rhinestone standalone server is running on port ${port}`)
    logger.log(`📡 WebSocket URL: ${process.env.RHINESTONE_WS_URL || 'ws://localhost:8080'}`)
  } catch (error) {
    logger.error('Failed to create app:', error)
    throw error
  }
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap')
  logger.error('Failed to start Rhinestone standalone server:', error)
  process.exit(1)
})
