export default {
  server: {
    url: process.env.SERVICE_URL || 'https://solver-preprod.bend.eco',
  },

  indexer: {
    url: process.env.INDEXER_URL || 'https://protocol-indexer-production.up.railway.app',
  },

  gitConfig: {
    repo: 'eco-incorp/config-eco-solver',
    branch: 'main',
    env: 'preproduction',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'eco-solver-secrets-pre-prod',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes-preprod.eco.com',
    },
  },
}
