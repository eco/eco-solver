export default {
  server: {
    url: process.env.SERVICE_URL || 'https://solver.bend.eco',
  },

  indexer: {
    url: process.env.INDEXER_URL || 'https://protocol-indexer-production.up.railway.app',
  },
  gitConfig: {
    repo: 'eco-incorp/config-eco-solver',
    branch: 'main',
    env: 'production',
  },
  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'eco-solver-secrets-prod',
    },
  ],

  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes.eco.com',
    },
  },
}
