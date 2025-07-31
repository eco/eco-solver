import 'dotenv/config'
import { Injectable, Logger } from '@nestjs/common'
import { EcoConfigType } from '@/eco-configs/eco-config.types'
import { Hex } from 'viem'

@Injectable()
export class MockEcoConfigService {
  private logger = new Logger(MockEcoConfigService.name)
  private config: Partial<EcoConfigType> = {
    rhinestone: {
      websocket: {
        url: process.env.RHINESTONE_WS_URL || 'wss://v1.orchestrator.rhinestone.dev/ws/relayers',
      },
      api: {
        orchestratorUrl:
          process.env.RHINESTONE_ORCHESTRATOR_URL || 'https://orchestrator.rhinestone.wtf',
        orchestratorApiKey: process.env.RHINESTONE_API_KEY || 'test-api-key',
      },
      order: {
        settlementLayer: 'ECO',
      },
      contracts: {
        '10': {
          router: '0x000000000004598d17aad017bf0734a364c5588b',
          ecoAdapter: '0xa0de4A8e033FBceC2BFa708FaD59e1587839b4Ca',
          ecoArbiter: '0x0000000000814Cf877224D19919490d4761B0C86',
        },
        '8453': {
          router: '0x000000000004598d17aad017bf0734a364c5588b',
          ecoAdapter: '0xa0de4A8e033FBceC2BFa708FaD59e1587839b4Ca',
          ecoArbiter: '0x0000000000814Cf877224D19919490d4761B0C86',
        },
      },
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
      privateKey: process.env.ETH_PRIVATE_KEY as Hex,
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
    // Validate required environment variables
    if (!process.env.ETH_PRIVATE_KEY) {
      throw new Error('ETH_PRIVATE_KEY environment variable is required')
    }
    if (!process.env.SIGNER_PRIVATE_KEY) {
      throw new Error('SIGNER_PRIVATE_KEY environment variable is required')
    }
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
