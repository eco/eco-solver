/* eslint-disable prettier/prettier */
export default {
  server: {
    // url: 'https://solver.staging.bend.eco',
    url: 'https://solver-bg.staging.eco.com',
  },

  // aws: [
  //   {
  //     region: 'us-east-2',
  //     secretID: 'eco-solver-secrets-staging',
  //   },
  //   {
  //     region: 'us-east-2',
  //     secretID: 'eco-solver-configs-staging',
  //   },
  //   {
  //     region: 'us-east-2',
  //     secretID: 'eco-solver-whitelist-staging',
  //   },
  // ],

/*
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
      secretID: 'eco-solver-configs-chains-preprod',
    },
    {
      region: 'us-east-2',
      secretID: 'eco-solver-whitelist-pre-prod',
    },

*/

  aws: [
    {
      region: 'us-east-2',
      secretID: 'solver-secrets-staging-bg',
    },
    {
      region: 'us-east-2',
      secretID: 'solver-configs-staging-bg',
    },
    {
      region: 'us-east-2',
      secretID: 'solver-configs-chains-staging-bg',
    },
    {
      region: 'us-east-2',
      secretID: 'solver-whitelist-staging-bg',
    },
  ],

  //don't add anything else here

  solverRegistrationConfig: {
    apiOptions: {
      // baseUrl: 'https://quotes-preprod.eco.com',
      baseUrl: 'https://quotes-bg.staging.eco.com',
    },
  },
}
