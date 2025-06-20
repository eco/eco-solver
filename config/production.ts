export default {
  server: {
    url: 'https://solver.prod.bend.eco',
  },

  indexer: {
    url: 'https://protocol-indexer-production.up.railway.app',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: 'eco-solver-secrets-prod',
    },
    {
      region: 'us-east-2',
      secretID: 'eco-solver-configs-prod',
    },
    {
      region: 'us-east-2',
      secretID: 'eco-solver-configs-chains-prod',
    },
    {
      region: 'us-east-2',
      secretID: 'eco-solver-whitelist-prod',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'https://quotes.eco.com',
    },
  },
}
