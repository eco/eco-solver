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
      network: 'towns-testnet',
      chainID: 6524490,
      tokens: [
        '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', //usdc
      ],
    },
    {
      network: 'sanko-testnet',
      chainID: 1992,
      tokens: [
        '0xC38944D590A3B6E796dE242680259CB1dEcba077', //usdc
      ],
    },
  ],
  solvers: {
    //towns testnet
    6524490: {
      targets: {
        //towns testnet USDC
        '0x9030B1b203D7F7aE07aa32a2eFbF5DEE7112FE30': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 1000,
        },
      },
      network: 'towns-testnet',
      chainID: 6524490,
      averageBlockTime: 2,
    },
    //sanko testnet
    1992: {
      targets: {
        //sanko testnet USDC
        '0xC38944D590A3B6E796dE242680259CB1dEcba077': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 1000,
        },
      },
      network: 'sanko-testnet',
      chainID: 1992,
      averageBlockTime: 2,
    },
  },

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'http://localhost:4000',
    },
  },
}
