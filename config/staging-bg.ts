export default {
  server: {
    url: process.env.SERVICE_URL || 'https://solver-bg.staging.eco',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'solver-secrets-staging-bg',
    },
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_CONFIGS || 'solver-configs-staging-bg',
    },
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_CHAINS || 'solver-configs-chains-staging-bg',
    },
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_WHITELIST || 'solver-whitelist-staging-bg',
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: process.env.REGISTRATION_URL || 'https://quotes-bg.staging.eco.com',
    },
  },
}
