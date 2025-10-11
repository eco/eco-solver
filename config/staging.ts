export default {
  server: {
    // url: process.env.SERVICE_URL || 'https://solver.staging.bend.eco',
    url: 'https://solver-blue.staging.eco.com',
  },

  gitConfig: {
    repo: 'eco-incorp/config-eco-solver',
    branch: 'main',
    env: 'staging',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'eco-solver-secrets-staging',
    },
  ],

  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'https://quotes-blue.staging.eco.com',
      // baseUrl: process.env.REGISTRATION_URL || 'https://quotes-preprod.eco.com',
      // baseUrl: 'https://quotes-bg.staging.eco.com',
    },
  },
}
