import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigType } from '@/eco-configs/eco-config.types'
import { Hex } from 'viem'

@Injectable()
export class MockEcoConfigService {
  private logger = new Logger(MockEcoConfigService.name)
  private config: Partial<EcoConfigType> = {
    rhinestone: {
      websocketUrl:
        process.env.RHINESTONE_WS_URL || 'wss://orchestrator.rhinestone.wtf/bundles/events',
      orchestratorUrl:
        process.env.RHINESTONE_ORCHESTRATOR_URL || 'https://orchestrator.rhinestone.wtf',
      orchestratorApiKey:
        process.env.RHINESTONE_API_KEY || 'test-api-key',
    },
    logger: {
      usePino: false,
      pinoConfig: {
        pinoHttp: {
          level: 'debug',
        },
      },
    },
    eth: {
      privateKey: process.env.ETH_PRIVATE_KEY as Hex, // Default test private key
      simpleAccount: {
        walletAddr: '0x0000000000000000000000000000000000000000' as Hex,
        signerPrivateKey: process.env.SIGNER_PRIVATE_KEY as Hex,
        minEthBalanceWei: 0,
        contracts: {
          entryPoint: {
            contractAddress: '0x0000000000000000000000000000000000000000' as Hex,
          },
          paymaster: {
            contractAddresses: [] as Hex[],
          },
          simpleAccountFactory: {
            contractAddress: '0x0000000000000000000000000000000000000000' as Hex,
          },
        },
      },
      claimant: '0x0000000000000000000000000000000000000000' as Hex,
      nonce: {
        update_interval_ms: 1000,
      },
      pollingInterval: 1000,
    },
    rpcs: {
      config: {
        webSockets: false,
      },
      keys: {},
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

  getEth(): EcoConfigType['eth'] {
    return this.config.eth!
  }

  getRPCs(): EcoConfigType['rpcs'] {
    return this.config.rpcs!
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
