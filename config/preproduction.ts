export default {
  server: {
    url: 'https://solver-preprod.bend.eco',
  },

  indexer: {
    url: 'https://protocol-indexer-production.up.railway.app',
  },

  aws: [
    {
      region: 'us-west-2',
      secretID: 'eco-solver-secrets-pre-prod',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-configs-pre-prod',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-configs-chains-preprod',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-whitelist-pre-prod',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'https://quotes-preprod.eco.com',
    },
  },
}
