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
  intentConfigs: {
    defaultFee: {
      limitFillBase6: 1000n * 10n ** 6n,
      algorithm: 'linear',
      constants: {
        baseFee: 20_000n,
        tranche: {
          unitFee: 15_000n,
          unitSize: 100_000_000n,
        },
      },
    },
    proofs: {
      storage_duration_seconds: 604800,
      hyperlane_duration_seconds: 3600,
    },
  },
  whitelist: {},
  liquidityManager: {
    intervalDuration: 300000,
    targetSlippage: 0.02,
    thresholds: {
      surplus: 0.1,
      deficit: 0.2,
    },
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
    ],
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
}
