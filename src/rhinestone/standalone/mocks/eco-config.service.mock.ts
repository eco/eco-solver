import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigType } from '@/eco-configs/eco-config.types'

@Injectable()
export class MockEcoConfigService {
  private logger = new Logger(MockEcoConfigService.name)
  private config: Partial<EcoConfigType> = {
    rhinestone: {
      websocketUrl:
        process.env.RHINESTONE_WS_URL || 'wss://orchestrator.rhinestone.wtf/bundles/events',
    },
    logger: {
      usePino: false,
      pinoConfig: {
        pinoHttp: {
          level: 'debug',
        },
      },
    },
  }

  constructor() {
    this.logger.log('MockEcoConfigService initialized')
  }

  getRhinestone(): EcoConfigType['rhinestone'] {
    return this.config.rhinestone!
  }

  get<T = any>(key: string): T {
    const keys = key.split('.')
    let result: any = this.config

    for (const k of keys) {
      result = result?.[k]
    }

    return result as T
  }

  getLoggerConfig() {
    return this.config.logger!
  }

  // Static method to match the original
  static getStaticConfig() {
    return {
      logger: {
        usePino: false,
        pinoConfig: {
          pinoHttp: {
            level: 'debug',
          },
        },
      },
    }
  }
}
