export default {
  server: {
    url: 'http://localhost:3000',
  },

  logger: {
    usePino: false,
  },
  database: {
    auth: {
      enabled: false,
      username: '',
      password: '',
      type: '',
    },

    uriPrefix: 'mongodb://',
    uri: 'localhost:27017',
    dbName: 'eco-solver-local',
    enableJournaling: true,
  },
  redis: {
    connection: {
      host: 'localhost',
      port: 6379,
    },
    jobs: {
      //remove on complete/fail for dev so we can submit the same tx multiple times
      intentJobConfig: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    },
  },
  intentSources: [
    {
      network: 'optimism',
      chainID: 10,
      tokens: [
        '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', //usdc
      ],
    },
    {
      network: 'base',
      chainID: 8453,
      tokens: [
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', //usdc
      ],
    },
  ],
  solvers: {
    //base sepolia
    8453: {
      targets: {
        //base mainnet USDC
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 1000,
        },
      },
      network: 'base',
      chainID: 8453,
      averageBlockTime: 2,
      gasOverhead: 145_000,
    },
    //op sepolia
    10: {
      targets: {
        //op mainnet USDC
        '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 1000,
        },
      },
      network: 'optimism',
      chainID: 10,
      averageBlockTime: 2,
      gasOverhead: 145_000,
    },
  },

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'http://localhost:4000',
    },
  },

  crowdLiquidity: {
    litNetwork: 'datil-dev',
    capacityTokenId: 'placeholder-token-id',
    capacityTokenOwnerPk: '0x0000000000000000000000000000000000000000000000000000000000000000',
    defaultTargetBalance: 1000,
    feePercentage: 0.1,
    actions: {
      fulfill: 'placeholder-fulfill-action',
      rebalance: 'placeholder-rebalance-action',
    },
    kernel: {
      address: '0x0000000000000000000000000000000000000000',
    },
    pkp: {
      ethAddress: '0x0000000000000000000000000000000000000000',
      publicKey: 'placeholder-public-key',
    },
    supportedTokens: [],
  },

  liFi: {
    integrator: 'eco-solver-dev',
    apiKey: '',
  },

  squid: {
    integratorId: 'test-integrator',
    baseUrl: 'https://test.api.squidrouter.com',
  },

  fulfillment: {
    enabled: true,
    run: 'single',
    type: 'smart-wallet-account',
  },

  liquidityManager: {
    providers: [
      {
        name: 'LiFi',
        enabled: false,
      },
    ],
  },
}
