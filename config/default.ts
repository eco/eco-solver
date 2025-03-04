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
    proofs: {
      storage_duration_seconds: 604800,
      hyperlane_duration_seconds: 3600,
    },
  },
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
        tokenMessenger: '0xbd3fa81b58ba92a82136038b25adec7066af3155',
        messageTransmitter: '0x0a992d191deec32afe36203ad87d7d289a738f81',
      },
      {
        chainId: 10,
        domain: 2,
        tokenMessenger: '0x2B4069517957735bE00ceE0fadAE88a26365528f',
        messageTransmitter: '0x4d41f22c5a0e5c74090899e5a8fb597a8842b3e8',
      },
      {
        chainId: 137,
        domain: 7,
        tokenMessenger: '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
        messageTransmitter: '0xF3be9355363857F3e001be68856A2f96b4C39Ba9',
      },
      {
        chainId: 8453,
        domain: 6,
        tokenMessenger: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
        messageTransmitter: '0xAD09780d193884d503182aD4588450C416D6F9D4',
      },
      {
        chainId: 42161,
        domain: 3,
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
