export default {
  gitConfig: {
    repo: 'eco-incorp/config-eco-solver',
    branch: 'preprod-stoyan',
    env: 'staging',
  },
  server: {
    url: process.env.SERVICE_URL || 'https://solver.staging.bend.eco',
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
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes-preprod.eco.com',
    },
  },
}
