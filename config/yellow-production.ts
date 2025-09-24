export default {
  server: {
    url: process.env.SERVICE_URL || 'https://solver-yellow.eco.com',
  },

  indexer: {
    url: process.env.INDEXER_URL || 'https://protocol-indexer-production.up.railway.app',
  },
  gitConfig: {
    repo: 'eco-incorp/config-eco-solver',
    branch: 'main',
    env: 'production-yellow',
  },
  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'solver-yellow-production',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes-yellow.eco.com',
    },
  },
}
