export default {
  aws: [
    {
      region: 'us-east-2',
      secretID: 'eco-solver-secrets-dev',
    },
    {
      region: 'us-east-2',
      secretID: 'eco-solver-configs-dev',
    },
    {
      region: 'us-east-2',
      secretID: 'eco-solver-whitelist-dev',
    },
  ],
  cache: {
    ttl: 10_000, // milliseconds till cache key expires
  },
  redis: {
    options: {
      single: {
        autoResubscribe: true,
        autoResendUnfulfilledCommands: true,
        tls: {},
      },
      cluster: {
        enableReadyCheck: true,
        retryDelayOnClusterDown: 300,
        retryDelayOnFailover: 1000,
        retryDelayOnTryAgain: 3000,
        slotsRefreshTimeout: 10000,
        clusterRetryStrategy: (times: number): number => Math.min(times * 1000, 10000),
        dnsLookup: (address: string, callback: any) => callback(null, address, 6),
      },
    },
    redlockSettings: {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 200,
    },
    jobs: {
      intentJobConfig: {
        removeOnComplete: false,
        removeOnFail: false,

        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2_000,
        },
      },
      watchJobConfig: {
        removeOnComplete: true,
        removeOnFail: false,

        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2_000,
        },
      },
    },
  },
  intervals: {
    retryInfeasableIntents: {
      repeatOpts: {
        every: 300_000, // 5 minutes
      },
      jobTemplate: {
        name: 'retry-infeasable-intents',
        data: {},
      },
    },
    defaults: {
      repeatOpts: {
        every: 300_000, // 5 minutes
      },
      jobTemplate: {
        name: 'default-interval-job',
        data: {},
        opts: {
          removeOnComplete: true,
          removeOnFail: true,

          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2_000,
          },
        },
      },
    },
  },

  quotesConfig: {
    intentExecutionTypes: ['SELF_PUBLISH', 'GASLESS'],
  },

  gaslessIntentdAppIDs: ['token-pair-validation', 'matrix-test', 'test', 'sdk-demo'],

  intentConfigs: {
    defaultFee: {
      limit: {
        tokenLimit: 1000n * 10n ** 6n,
        nativeLimit: 1000n * 10n ** 6n,
      },
      algorithm: 'linear',
      constants: {
        token: {
          baseFee: 20_000n,
          tranche: {
            unitFee: 15_000n,
            unitSize: 100_000_000n,
          },
        },
        native: {
          baseFee: 1_000n,
          tranche: {
            unitFee: 500n, // 500 wei
            unitSize: 1n * 10n ** 18n, // 1 ETH
          },
        },
      },
    },
    proofs: {
      hyperlane_duration_seconds: 3600,
      metalayer_duration_seconds: 7200,
    },
    intentFundedRetries: 3,
    intentFundedRetryDelayMs: 500,
    // Gas overhead is the intent creation gas cost for the source chain, i.e. the cost of calling publishAndFund on IntentSource.
    // This is the default gas overhead
    defaultGasOverhead: 145_000,
  },
  whitelist: {},

  fulfillmentEstimate: {
    // Padding to add to the execution-time estimation
    executionPaddingSeconds: 0.5,
    // Percentile of block time to use for execution-time estimation
    blockTimePercentile: 0.5,
    // Default block time to use for unknown chains
    defaultBlockTime: 2,
  },

  gasEstimations: {
    fundFor: 150_000n,
    permit: 60_000n,
    permit2: 80_000n,
    defaultGasPriceGwei: '30',
  },

  indexer: {
    url: 'https://protocol-indexer-production.up.railway.app',
  },
  withdraws: {
    chunkSize: 20,
    intervalDuration: 360_000,
  },

  sendBatch: {
    chunkSize: 200,
    intervalDuration: 360_000,
    defaultGasPerIntent: 25_000,
  },

  CCTP: {
    apiUrl: 'https://iris-api.circle.com',
    chains: [
      {
        chainId: 1,
        domain: 0,
        token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        tokenMessenger: '0xbd3fa81b58ba92a82136038b25adec7066af3155',
        messageTransmitter: '0x0a992d191deec32afe36203ad87d7d289a738f81',
      },
      {
        chainId: 10,
        domain: 2,
        token: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
        tokenMessenger: '0x2B4069517957735bE00ceE0fadAE88a26365528f',
        messageTransmitter: '0x4d41f22c5a0e5c74090899e5a8fb597a8842b3e8',
      },
      {
        chainId: 137,
        domain: 7,
        token: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        tokenMessenger: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
        messageTransmitter: '0xF3be9355363857F3e001be68856A2f96b4C39Ba9',
      },
      {
        chainId: 8453,
        domain: 6,
        token: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        tokenMessenger: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
        messageTransmitter: '0xAD09780d193884d503182aD4588450C416D6F9D4',
      },
      {
        chainId: 42161,
        domain: 3,
        token: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
        tokenMessenger: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
        messageTransmitter: '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca',
      },
      {
        chainId: 130,
        domain: 10,
        token: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
        tokenMessenger: '0x4e744b28E787c3aD0e810eD65A24461D4ac5a762',
        messageTransmitter: '0x353bE9E2E38AB1D19104534e4edC21c643Df86f4',
      },
    ],
  },

  CCTPV2: {
    apiUrl: 'https://iris-api.circle.com',
    chains: [
      {
        chainId: 1, // Ethereum
        domain: 0,
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
        messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      },
      {
        chainId: 10, // Optimism
        domain: 2,
        token: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
        messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      },
      {
        chainId: 137, // Polygon
        domain: 7,
        token: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
        messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      },
      {
        chainId: 8453, // Base
        domain: 6,
        token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
        messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      },
      {
        chainId: 42161, // Arbitrum
        domain: 3,
        token: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
        messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      },
      {
        chainId: 146, // Sonic
        domain: 13,
        token: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
        tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
        messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      },
      {
        chainId: 480, // World Chain
        domain: 14,
        token: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1',
        tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
        messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      },
      {
        chainId: 130, // Uni Chain
        domain: 10,
        token: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
        tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
        messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
      },
    ],
  },

  hyperlane: {
    useHyperlaneDefaultHook: false,
  },

  externalAPIs: {},
  logger: {
    usePino: true,
    pinoConfig: {
      pinoHttp: {
        level: 'debug',
        useLevelLabels: true,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.accept',
            'req.headers["cache-control"]',
            'req.headers["accept-encoding"]',
            'req.headers["content-type"]',
            'req.headers["content-length"]',
            'req.headers.connection',
            'res.headers',
            'err.stack',
          ],
          remove: true,
        },
      },
    },
  },

  squid: {
    baseUrl: 'https://v2.api.squidrouter.com',
  },

  everclear: {
    baseUrl: 'https://api.everclear.org',
  },

  gateway: {
    apiUrl: 'https://gateway-api.circle.com',
    chains: [
      {
        chainId: 1,
        domain: 0,
        usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        wallet: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE',
        minter: '0x2222222d7164433c4C09B0b0D809a9b52C04C205',
      },
      {
        chainId: 8453, // Base
        domain: 6,
        usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        wallet: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE',
        minter: '0x2222222d7164433c4C09B0b0D809a9b52C04C205',
      },
      {
        chainId: 10, // Optimism
        domain: 2,
        usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
        wallet: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE',
        minter: '0x2222222d7164433c4C09B0b0D809a9b52C04C205',
      },
      {
        chainId: 42161, // Arbitrum
        domain: 3,
        usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        wallet: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE',
        minter: '0x2222222d7164433c4C09B0b0D809a9b52C04C205',
      },
      {
        chainId: 137, // Polygon PoS
        domain: 7,
        usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        wallet: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE',
        minter: '0x2222222d7164433c4C09B0b0D809a9b52C04C205',
      },
      {
        chainId: 130, // Unichain
        domain: 10,
        usdc: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
        wallet: '0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE',
        minter: '0x2222222d7164433c4C09B0b0D809a9b52C04C205',
      },
    ],
    fees: {
      // Default promotional percentage: 0.5 bps
      percent: { numerator: 5, denominator: 100_000 },
      // Per-domain base fees in USDC base-6, from Circle docs
      base6ByDomain: {
        0: 2_000_000, // Ethereum
        1: 20_000, // Avalanche
        2: 1_500, // OP
        3: 10_000, // Arbitrum
        6: 10_000, // Base
        7: 1_500, // Polygon PoS
        10: 1_000, // Unichain
      },
      // Conservative fallback = Ethereum base fee
      fallbackBase6: 2_000_000,
    },
  },

  watch: {
    recoveryBackoffBaseMs: 1_000,
    recoveryBackoffMaxMs: 30_000,
    recoveryStabilityWindowMs: 60_000,
  },
}
