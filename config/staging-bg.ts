export default {
  server: {
    url: process.env.SERVICE_URL || 'https://solver-bg.staging.eco.com',
  },
  gitConfig: {
    repo: 'eco-incorp/config-eco-solver',
    branch: 'main',
    env: 'staging-bg',
  },
  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'solver-secrets-staging-bg',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes-bg.staging.eco.com',
    },
  },
}
