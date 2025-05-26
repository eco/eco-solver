export default {
  server: {
    url: 'https://solver.prod.bend.eco',
  },

  aws: [
    {
      region: 'us-west-2',
      secretID: 'eco-solver-secrets-prod-test',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-configs-prod-test',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-configs-chains-prod-test',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-whitelist-prod-test',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'https://quotes.eco.com',
    },
  },
}
