export default {
  server: {
    url: 'https://solver.staging.bend.eco',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'eco-solver-secrets-staging',
    },
  ],
  git: [
    {
      repo: 'eco-incorp/config-eco-solver',
      hash: '7e596cf30b5163b18e393828dd6287df812b7674',
      env: 'staging',
      token: process.env.GITHUB_TOKEN,
    },
  ],
  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'https://quotes-preprod.eco.com',
    },
  },
}
