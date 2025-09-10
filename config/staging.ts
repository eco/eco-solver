export default {
  server: {
    url: process.env.SERVICE_URL || 'https://solver.staging.bend.eco',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'eco-solver-secrets-staging',
    },
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_CONFIGS || 'eco-solver-configs-staging',
    },
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_CHAINS || 'eco-solver-configs-chains-staging',
    },
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_WHITELIST || 'eco-solver-whitelist-staging',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes-preprod.eco.com',
    },
  },
}
