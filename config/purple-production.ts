export default {
  server: {
    url: process.env.SERVICE_URL || 'https://solver-purple.eco.com',
  },

  indexer: {
    url: process.env.INDEXER_URL || 'https://protocol-indexer-production.up.railway.app',
  },

  gitConfig: {
    repo: 'eco-incorp/config-eco-solver',
    branch: 'main',
    env: 'production-purple',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'solver-purple-production',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes-purple.eco.com',
    },
  },
}
