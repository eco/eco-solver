export default {
  server: {
    url: 'https://solver.staging.bend.eco',
  },

  aws: [
    {
      region: 'us-west-2',
      secretID: 'eco-solver-secrets-staging',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-configs-staging',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-whitelist-staging',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'https://quotes-preprod.eco.com',
    },
  },
}
