export default {
  server: {
    url: 'https://solver-preprod.bend.eco',
  },

  indexer: {
    url: 'https://protocol-indexer-production.up.railway.app',
  },

  aws: [
    {
      region: 'us-east-2',
      secretID: process.env.AWS_SECRET_ID_MISC || 'eco-solver-secrets-pre-prod',
    },
  ],

  git: [
    {
      repo: 'eco-incorp/config-eco-solver',
      branch: 'preprod-stoyan',
      env: 'preprod',
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
