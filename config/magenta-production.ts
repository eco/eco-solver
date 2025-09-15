export default {
  server: {
    url: process.env.SERVICE_URL || 'https://solver-magenta.eco.com',
  },

  indexer: {
    url: process.env.INDEXER_URL || 'https://protocol-indexer-production.up.railway.app',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'solver-magenta-production',
    },
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_CONFIGS || 'solver-configs-magenta-production',
    },
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_CHAINS || 'solver-configs-chains-magenta-production',
    },
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_WHITELIST || 'solver-whitelist-magenta-production',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes-magenta.eco.com',
    },
  },
}
