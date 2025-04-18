export default {
  server: {
    url: 'https://solver.prod.bend.eco',
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
      secretID: 'eco-solver-whitelist-prod',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'https://quoter.bend.eco',
    },
  },
}
