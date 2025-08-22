declare const configs: {
  default: {
    aws: {
      region: string
      secretID: string
    }[]
    cache: {
      ttl: number
    }
    redis: {
      options: {
        single: {
          autoResubscribe: boolean
          autoResendUnfulfilledCommands: boolean
          tls: {}
        }
        cluster: {
          enableReadyCheck: boolean
          retryDelayOnClusterDown: number
          retryDelayOnFailover: number
          retryDelayOnTryAgain: number
          slotsRefreshTimeout: number
          clusterRetryStrategy: (times: number) => number
          dnsLookup: (address: string, callback: any) => any
        }
      }
      redlockSettings: {
        driftFactor: number
        retryCount: number
        retryDelay: number
        retryJitter: number
      }
      jobs: {
        intentJobConfig: {
          removeOnComplete: boolean
          removeOnFail: boolean
          attempts: number
          backoff: {
            type: string
            delay: number
          }
        }
        watchJobConfig: {
          removeOnComplete: boolean
          removeOnFail: boolean
          attempts: number
          backoff: {
            type: string
            delay: number
          }
        }
      }
    }
    intervals: {
      retryInfeasableIntents: {
        repeatOpts: {
          every: number
        }
        jobTemplate: {
          name: string
          data: {}
        }
      }
      defaults: {
        repeatOpts: {
          every: number
        }
        jobTemplate: {
          name: string
          data: {}
          opts: {
            removeOnComplete: boolean
            removeOnFail: boolean
            attempts: number
            backoff: {
              type: string
              delay: number
            }
          }
        }
      }
    }
    quotesConfig: {
      intentExecutionTypes: string[]
    }
    gaslessIntentdAppIDs: string[]
    intentConfigs: {
      defaultFee: {
        limit: {
          tokenBase6: bigint
          nativeBase18: bigint
        }
        algorithm: string
        constants: {
          token: {
            baseFee: bigint
            tranche: {
              unitFee: bigint
              unitSize: bigint
            }
          }
          native: {
            baseFee: bigint
            tranche: {
              unitFee: bigint
              unitSize: bigint
            }
          }
        }
      }
      proofs: {
        hyperlane_duration_seconds: number
        metalayer_duration_seconds: number
      }
      intentFundedRetries: number
      intentFundedRetryDelayMs: number
      defaultGasOverhead: number
    }
    whitelist: {}
    fulfillmentEstimate: {
      executionPaddingSeconds: number
      blockTimePercentile: number
      defaultBlockTime: number
    }
    gasEstimations: {
      fundFor: bigint
      permit: bigint
      permit2: bigint
      defaultGasPriceGwei: string
    }
    indexer: {
      url: string
    }
    withdraws: {
      chunkSize: number
      intervalDuration: number
    }
    sendBatch: {
      chunkSize: number
      intervalDuration: number
      defaultGasPerIntent: number
    }
    CCTP: {
      apiUrl: string
      chains: {
        chainId: number
        domain: number
        token: string
        tokenMessenger: string
        messageTransmitter: string
      }[]
    }
    CCTPV2: {
      apiUrl: string
      chains: {
        chainId: number
        domain: number
        token: string
        tokenMessenger: string
        messageTransmitter: string
      }[]
    }
    hyperlane: {
      useHyperlaneDefaultHook: boolean
    }
    externalAPIs: {}
    logger: {
      usePino: boolean
      pinoConfig: {
        pinoHttp: {
          level: string
          useLevelLabels: boolean
          redact: {
            paths: string[]
            remove: boolean
          }
        }
      }
    }
    squid: {
      baseUrl: string
    }
    everclear: {
      baseUrl: string
    }
  }
  development: {
    server: {
      url: string
    }
    logger: {
      usePino: boolean
    }
    database: {
      auth: {
        enabled: boolean
        username: string
        password: string
        type: string
      }
      uriPrefix: string
      uri: string
      dbName: string
      enableJournaling: boolean
    }
    redis: {
      connection: {
        host: string
        port: number
      }
      jobs: {
        intentJobConfig: {
          removeOnComplete: boolean
          removeOnFail: boolean
        }
      }
    }
    intentSources: {
      network: string
      chainID: number
      tokens: string[]
    }[]
    solvers: {
      84532: {
        targets: {
          '0xAb1D243b07e99C91dE9E4B80DFc2B07a8332A2f7': {
            contractType: string
            selectors: string[]
            minBalance: number
          }
          '0x8bDa9F5C33FBCB04Ea176ea5Bc1f5102e934257f': {
            contractType: string
            selectors: string[]
            minBalance: number
          }
          '0x93551e3F61F8E3EE73DDc096BddbC1ADc52f5A3a': {
            contractType: string
            selectors: string[]
            minBalance: number
          }
        }
        network: string
        chainID: number
        averageBlockTime: number
        gasOverhead: number
      }
      11155420: {
        targets: {
          '0x5fd84259d66Cd46123540766Be93DFE6D43130D7': {
            contractType: string
            selectors: string[]
            minBalance: number
          }
        }
        network: string
        chainID: number
        averageBlockTime: number
        gasOverhead: number
      }
    }
    solverRegistrationConfig: {
      apiOptions: {
        baseUrl: string
      }
    }
  }
  production: {
    server: {
      url: string
    }
    indexer: {
      url: string
    }
    aws: {
      region: string
      secretID: string
    }[]
    solverRegistrationConfig: {
      apiOptions: {
        baseUrl: string
      }
    }
  }
  preproduction: {
    server: {
      url: string
    }
    indexer: {
      url: string
    }
    aws: {
      region: string
      secretID: string
    }[]
    solverRegistrationConfig: {
      apiOptions: {
        baseUrl: string
      }
    }
  }
  staging: {
    server: {
      url: string
    }
    aws: {
      region: string
      secretID: string
    }[]
    solverRegistrationConfig: {
      apiOptions: {
        baseUrl: string
      }
    }
  }
  test: {
    aws: {
      region: string
      secretID: string
    }
    test: string
  }
}
type configKey = keyof typeof configs
export declare function getStaticSolverConfig(environment?: configKey): {
  aws: {
    region: string
    secretID: string
  }[]
  cache: {
    ttl: number
  }
  redis: {
    options: {
      single: {
        autoResubscribe: boolean
        autoResendUnfulfilledCommands: boolean
        tls: {}
      }
      cluster: {
        enableReadyCheck: boolean
        retryDelayOnClusterDown: number
        retryDelayOnFailover: number
        retryDelayOnTryAgain: number
        slotsRefreshTimeout: number
        clusterRetryStrategy: (times: number) => number
        dnsLookup: (address: string, callback: any) => any
      }
    }
    redlockSettings: {
      driftFactor: number
      retryCount: number
      retryDelay: number
      retryJitter: number
    }
    jobs: {
      intentJobConfig: {
        removeOnComplete: boolean
        removeOnFail: boolean
        attempts: number
        backoff: {
          type: string
          delay: number
        }
      }
      watchJobConfig: {
        removeOnComplete: boolean
        removeOnFail: boolean
        attempts: number
        backoff: {
          type: string
          delay: number
        }
      }
    }
  }
  intervals: {
    retryInfeasableIntents: {
      repeatOpts: {
        every: number
      }
      jobTemplate: {
        name: string
        data: {}
      }
    }
    defaults: {
      repeatOpts: {
        every: number
      }
      jobTemplate: {
        name: string
        data: {}
        opts: {
          removeOnComplete: boolean
          removeOnFail: boolean
          attempts: number
          backoff: {
            type: string
            delay: number
          }
        }
      }
    }
  }
  quotesConfig: {
    intentExecutionTypes: string[]
  }
  gaslessIntentdAppIDs: string[]
  intentConfigs: {
    defaultFee: {
      limit: {
        tokenBase6: bigint
        nativeBase18: bigint
      }
      algorithm: string
      constants: {
        token: {
          baseFee: bigint
          tranche: {
            unitFee: bigint
            unitSize: bigint
          }
        }
        native: {
          baseFee: bigint
          tranche: {
            unitFee: bigint
            unitSize: bigint
          }
        }
      }
    }
    proofs: {
      hyperlane_duration_seconds: number
      metalayer_duration_seconds: number
    }
    intentFundedRetries: number
    intentFundedRetryDelayMs: number
    defaultGasOverhead: number
  }
  whitelist: {}
  fulfillmentEstimate: {
    executionPaddingSeconds: number
    blockTimePercentile: number
    defaultBlockTime: number
  }
  gasEstimations: {
    fundFor: bigint
    permit: bigint
    permit2: bigint
    defaultGasPriceGwei: string
  }
  indexer: {
    url: string
  }
  withdraws: {
    chunkSize: number
    intervalDuration: number
  }
  sendBatch: {
    chunkSize: number
    intervalDuration: number
    defaultGasPerIntent: number
  }
  CCTP: {
    apiUrl: string
    chains: {
      chainId: number
      domain: number
      token: string
      tokenMessenger: string
      messageTransmitter: string
    }[]
  }
  CCTPV2: {
    apiUrl: string
    chains: {
      chainId: number
      domain: number
      token: string
      tokenMessenger: string
      messageTransmitter: string
    }[]
  }
  hyperlane: {
    useHyperlaneDefaultHook: boolean
  }
  externalAPIs: {}
  logger: {
    usePino: boolean
    pinoConfig: {
      pinoHttp: {
        level: string
        useLevelLabels: boolean
        redact: {
          paths: string[]
          remove: boolean
        }
      }
    }
  }
  squid: {
    baseUrl: string
  }
  everclear: {
    baseUrl: string
  }
} & (
  | {
      server: {
        url: string
      }
      indexer: {
        url: string
      }
      aws: {
        region: string
        secretID: string
      }[]
      solverRegistrationConfig: {
        apiOptions: {
          baseUrl: string
        }
      }
    }
  | {
      server: {
        url: string
      }
      indexer: {
        url: string
      }
      aws: {
        region: string
        secretID: string
      }[]
      solverRegistrationConfig: {
        apiOptions: {
          baseUrl: string
        }
      }
    }
  | {
      server: {
        url: string
      }
      aws: {
        region: string
        secretID: string
      }[]
      solverRegistrationConfig: {
        apiOptions: {
          baseUrl: string
        }
      }
    }
  | {
      aws: {
        region: string
        secretID: string
      }
      test: string
    }
)
declare const _default: {
  aws: {
    region: string
    secretID: string
  }[]
  cache: {
    ttl: number
  }
  redis: {
    options: {
      single: {
        autoResubscribe: boolean
        autoResendUnfulfilledCommands: boolean
        tls: {}
      }
      cluster: {
        enableReadyCheck: boolean
        retryDelayOnClusterDown: number
        retryDelayOnFailover: number
        retryDelayOnTryAgain: number
        slotsRefreshTimeout: number
        clusterRetryStrategy: (times: number) => number
        dnsLookup: (address: string, callback: any) => any
      }
    }
    redlockSettings: {
      driftFactor: number
      retryCount: number
      retryDelay: number
      retryJitter: number
    }
    jobs: {
      intentJobConfig: {
        removeOnComplete: boolean
        removeOnFail: boolean
        attempts: number
        backoff: {
          type: string
          delay: number
        }
      }
      watchJobConfig: {
        removeOnComplete: boolean
        removeOnFail: boolean
        attempts: number
        backoff: {
          type: string
          delay: number
        }
      }
    }
  }
  intervals: {
    retryInfeasableIntents: {
      repeatOpts: {
        every: number
      }
      jobTemplate: {
        name: string
        data: {}
      }
    }
    defaults: {
      repeatOpts: {
        every: number
      }
      jobTemplate: {
        name: string
        data: {}
        opts: {
          removeOnComplete: boolean
          removeOnFail: boolean
          attempts: number
          backoff: {
            type: string
            delay: number
          }
        }
      }
    }
  }
  quotesConfig: {
    intentExecutionTypes: string[]
  }
  gaslessIntentdAppIDs: string[]
  intentConfigs: {
    defaultFee: {
      limit: {
        tokenBase6: bigint
        nativeBase18: bigint
      }
      algorithm: string
      constants: {
        token: {
          baseFee: bigint
          tranche: {
            unitFee: bigint
            unitSize: bigint
          }
        }
        native: {
          baseFee: bigint
          tranche: {
            unitFee: bigint
            unitSize: bigint
          }
        }
      }
    }
    proofs: {
      hyperlane_duration_seconds: number
      metalayer_duration_seconds: number
    }
    intentFundedRetries: number
    intentFundedRetryDelayMs: number
    defaultGasOverhead: number
  }
  whitelist: {}
  fulfillmentEstimate: {
    executionPaddingSeconds: number
    blockTimePercentile: number
    defaultBlockTime: number
  }
  gasEstimations: {
    fundFor: bigint
    permit: bigint
    permit2: bigint
    defaultGasPriceGwei: string
  }
  indexer: {
    url: string
  }
  withdraws: {
    chunkSize: number
    intervalDuration: number
  }
  sendBatch: {
    chunkSize: number
    intervalDuration: number
    defaultGasPerIntent: number
  }
  CCTP: {
    apiUrl: string
    chains: {
      chainId: number
      domain: number
      token: string
      tokenMessenger: string
      messageTransmitter: string
    }[]
  }
  CCTPV2: {
    apiUrl: string
    chains: {
      chainId: number
      domain: number
      token: string
      tokenMessenger: string
      messageTransmitter: string
    }[]
  }
  hyperlane: {
    useHyperlaneDefaultHook: boolean
  }
  externalAPIs: {}
  logger: {
    usePino: boolean
    pinoConfig: {
      pinoHttp: {
        level: string
        useLevelLabels: boolean
        redact: {
          paths: string[]
          remove: boolean
        }
      }
    }
  }
  squid: {
    baseUrl: string
  }
  everclear: {
    baseUrl: string
  }
} & (
  | {
      server: {
        url: string
      }
      indexer: {
        url: string
      }
      aws: {
        region: string
        secretID: string
      }[]
      solverRegistrationConfig: {
        apiOptions: {
          baseUrl: string
        }
      }
    }
  | {
      server: {
        url: string
      }
      indexer: {
        url: string
      }
      aws: {
        region: string
        secretID: string
      }[]
      solverRegistrationConfig: {
        apiOptions: {
          baseUrl: string
        }
      }
    }
  | {
      server: {
        url: string
      }
      aws: {
        region: string
        secretID: string
      }[]
      solverRegistrationConfig: {
        apiOptions: {
          baseUrl: string
        }
      }
    }
  | {
      aws: {
        region: string
        secretID: string
      }
      test: string
    }
)
export default _default
