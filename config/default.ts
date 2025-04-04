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

  indexer: {
    url: 'https://indexer.eco.com',
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
