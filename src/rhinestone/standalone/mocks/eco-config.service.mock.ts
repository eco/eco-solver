import 'dotenv/config'
import { Injectable, Logger } from '@nestjs/common'
import { Chain, Hex } from 'viem'
import { EcoConfigType } from '@/eco-configs/eco-config.types'

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
          ecoAdapter: '0xcA1dD76132B6c642450654487eF685cc374CEE60',
          ecoArbiter: '0x0000000000814Cf877224D19919490d4761B0C86',
        },
        '8453': {
          router: '0x000000000004598d17aad017bf0734a364c5588b',
          ecoAdapter: '0xcA1dD76132B6c642450654487eF685cc374CEE60',
          ecoArbiter: '0x0000000000814Cf877224D19919490d4761B0C86',
        },
        '137': {
          router: '0x000000000004598d17aad017bf0734a364c5588b',
          ecoAdapter: '0xcA1dD76132B6c642450654487eF685cc374CEE60',
          ecoArbiter: '0x0000000000814Cf877224D19919490d4761B0C86',
        },
      },
    },
    cache: {
      ttl: 300,
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
    safe: {
      owner: '0x982E148216E3Aa6B38f9D901eF578B5c06DD7502',
    },
    kms: {
      region: 'us-east-2',
      keyID: 'fc27d855-c326-4252-b422-3b717ff1f85e',
    },
    rpcs: {
      config: {
        webSockets: false,
      },
      keys: {},
    },
    redis: {
      connection: { host: 'localhost', port: 6379 },
      options: {
        single: {},
        cluster: {},
      },
      jobs: {
        intentJobConfig: {
          removeOnComplete: true,
          removeOnFail: false,
        },
        watchJobConfig: {
          removeOnComplete: true,
          removeOnFail: false,
        },
      },
    },
    intentConfigs: {
      defaultFee: {
        limit: {
          tokenBase6: BigInt(1000000000), // 1000 USDC
          nativeBase18: BigInt('1000000000000000000'), // 1 ETH
        },
        algorithm: 'linear' as const,
        constants: {
          token: {
            baseFee: BigInt(0),
            tranche: {
              unitFee: BigInt(0),
              unitSize: BigInt(1000000), // 1 USDC
            },
          },
          native: {
            baseFee: BigInt(0),
            tranche: {
              unitFee: BigInt(0),
              unitSize: BigInt('1000000000000000'), // 0.001 ETH
            },
          },
        },
      },
      proofs: {
        hyperlane_duration_seconds: 3600,
        metalayer_duration_seconds: 3600,
      },
      isNativeETHSupported: true,
      defaultGasOverhead: 50000,
      intentFundedRetries: 3,
      intentFundedRetryDelayMs: 1000,
    },
    solvers: {
      10: {
        inboxAddress: '0x0000000000000000000000000000000000000000' as Hex,
        targets: {},
        network: 'OPTIMISM' as any,
        fee: {
          limit: {
            tokenBase6: BigInt(1000000000),
            nativeBase18: BigInt('1000000000000000000'),
          },
          algorithm: 'linear' as const,
          constants: {
            token: {
              baseFee: BigInt(0),
              tranche: {
                unitFee: BigInt(0),
                unitSize: BigInt(1000000),
              },
            },
            native: {
              baseFee: BigInt(0),
              tranche: {
                unitFee: BigInt(0),
                unitSize: BigInt('1000000000000000'),
              },
            },
          },
        },
        chainID: 10,
        averageBlockTime: 2,
      },
      8453: {
        inboxAddress: '0x0000000000000000000000000000000000000000' as Hex,
        targets: {
          '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913': {
            contractType: 'erc20' as any,
            selectors: ['transfer(address,uint256)'],
            minBalance: 0,
            targetBalance: 0,
          },
        },
        network: 'BASE' as any,
        fee: {
          limit: {
            tokenBase6: BigInt(1000000000),
            nativeBase18: BigInt('1000000000000000000'),
          },
          algorithm: 'linear' as const,
          constants: {
            token: {
              baseFee: BigInt(0),
              tranche: {
                unitFee: BigInt(0),
                unitSize: BigInt(1000000),
              },
            },
            native: {
              baseFee: BigInt(0),
              tranche: {
                unitFee: BigInt(0),
                unitSize: BigInt('1000000000000000'),
              },
            },
          },
        },
        chainID: 8453,
        averageBlockTime: 2,
      },
      137: {
        inboxAddress: '0x0000000000000000000000000000000000000000' as Hex,
        targets: {
          '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359': {
            contractType: 'erc20' as any,
            selectors: ['transfer(address,uint256)'],
            minBalance: 0,
            targetBalance: 0,
          },
        },
        network: 'POLYGON' as any,
        fee: {
          limit: {
            tokenBase6: BigInt(1000000000),
            nativeBase18: BigInt('1000000000000000000'),
          },
          algorithm: 'linear' as const,
          constants: {
            token: {
              baseFee: BigInt(0),
              tranche: {
                unitFee: BigInt(0),
                unitSize: BigInt(1000000),
              },
            },
            native: {
              baseFee: BigInt(0),
              tranche: {
                unitFee: BigInt(0),
                unitSize: BigInt('1000000000000000'),
              },
            },
          },
        },
        chainID: 137,
        averageBlockTime: 0.2,
      },
    },
    intentSources: [
      {
        network: 'OPTIMISM' as any,
        chainID: 10,
        sourceAddress: '0x2020ae689ED3e017450280CEA110d0ef6E640Da4' as Hex,
        inbox: '0x04c816032A076dF65b411Bb3F31c8d569d411ee2' as Hex,
        tokens: [],
        provers: ['0xb39dca629be804b9e0ec7e6a7802f94f6a7cbb89' as Hex],
      },
      {
        network: 'BASE' as any,
        chainID: 8453,
        sourceAddress: '0x2020ae689ED3e017450280CEA110d0ef6E640Da4' as Hex,
        inbox: '0x04c816032A076dF65b411Bb3F31c8d569d411ee2' as Hex,
        tokens: [],
        provers: ['0xb39dca629be804b9e0ec7e6a7802f94f6a7cbb89' as Hex],
      },
    ],
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

  getRedis() {
    return this.config.redis!
  }

  getIntentConfigs() {
    return this.config.intentConfigs!
  }

  getSolver(chainId: number) {
    return this.config.solvers?.[chainId] || null
  }

  getIntentSource(chainId: number) {
    return this.config.intentSources?.[chainId] || null
  }

  getKmsConfig() {
    return this.config.kms
  }

  getSafe() {
    return this.config.safe
  }

  getRpcUrls(chain: Chain) {
    return {
      rpcUrls: [chain.rpcUrls.default.http[0]],
      config: this.config.rpcs!.config,
    }
  }

  getSolvers() {
    return this.config.solvers || {}
  }

  getIntentSources() {
    return this.config.intentSources!
  }

  getCache() {
    return this.config.cache!
  }

  getSupportedChains(): bigint[] {
    return Object.entries(this.getSolvers()).map(([, solver]) => BigInt(solver.chainID))
  }

  getWhitelist() {
    return {
      solver: {
        '10': {
          fee: {
            whitelistedIntents: [],
          },
        },
        '8453': {
          fee: {
            whitelistedIntents: [],
          },
        },
      },
    }
  }
}
