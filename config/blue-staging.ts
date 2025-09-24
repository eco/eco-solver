export default {
  server: {
    url: process.env.SERVICE_URL || 'https://solver-blue.staging.eco.com',
  },

  indexer: {
    url: process.env.INDEXER_URL || 'https://protocol-indexer-production.up.railway.app',
  },
  gitConfig: {
    repo: 'eco-incorp/config-eco-solver',
    branch: 'main',
    env: 'staging-blue',
  },
  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'solver-blue-staging',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes-blue.staging.eco.com',
    },
  },
}
