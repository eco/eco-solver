export default {
  server: {
    url: 'https://solver-preprod.bend.eco',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: 'eco-solver-secrets-pre-prod',
    },
    {
      region: 'us-east-2',
      secretID: 'eco-solver-configs-pre-prod',
    },
    {
      region: 'us-east-2',
      secretID: 'eco-solver-whitelist-pre-prod',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'https://quoter-preprod.bend.eco',
    },
  },
}
