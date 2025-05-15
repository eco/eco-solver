export default {
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
      network: 'opt-sepolia',
      chainID: 11155420,
      tokens: [
        '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', //usdc
        '0x8327Db9040811545C13331A453aBe9C7AA1aCDf8',
        '0x368d7C52B0F62228907C133204605a5B11A1dB6d',
        '0x00D2d1162c689179e8bA7a3b936f80A010A0b5CF',
        '0x3328C29843F7c7dfF7381aF54A03C7423431Eaa4',
        '0xd3F4Bef596a04e2be4fbeB17Dd70f02F717c5a6c',
        '0x93551e3F61F8E3EE73DDc096BddbC1ADc52f5A3a',
      ],
    },
    {
      network: 'base-sepolia',
      chainID: 84532,
      tokens: [
        '0xAb1D243b07e99C91dE9E4B80DFc2B07a8332A2f7', //usdc
        '0x8bDa9F5C33FBCB04Ea176ea5Bc1f5102e934257f',
        '0x93551e3F61F8E3EE73DDc096BddbC1ADc52f5A3a',
      ],
    },
  ],
  solvers: {
    //base sepolia
    84532: {
      targets: {
        //base sepolia USDC
        '0xAb1D243b07e99C91dE9E4B80DFc2B07a8332A2f7': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 1000,
        },
        '0x8bDa9F5C33FBCB04Ea176ea5Bc1f5102e934257f': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 1000,
        },
        '0x93551e3F61F8E3EE73DDc096BddbC1ADc52f5A3a': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 1000,
        },
      },
      network: 'base-sepolia',
      chainID: 84532,
      averageBlockTime: 2,
    },
    //op sepolia
    11155420: {
      targets: {
        //op sepolia USDC
        '0x5fd84259d66Cd46123540766Be93DFE6D43130D7': {
          contractType: 'erc20',
          selectors: ['transfer(address,uint256)'],
          minBalance: 1000,
        },
      },
      network: 'opt-sepolia',
      chainID: 11155420,
      averageBlockTime: 2,
    },
  },
}
