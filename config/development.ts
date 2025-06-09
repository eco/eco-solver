export default {
  server: {
    url: 'http://localhost:3000',
  },
  aws: [
    {
      region: 'us-west-2',
      secretID: 'eco-solver-secrets-prod',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-configs-prod',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-configs-chains-prod',
    },
    {
      region: 'us-west-2',
      secretID: 'eco-solver-whitelist-prod',
    },
  ],

  logger: {
    usePino: false,
  },
  database: {
    auth: {
      enabled: false,
      username: '',
      password: '',
      type: '',
    },

    uriPrefix: 'mongodb://',
    uri: 'localhost:27017',
    dbName: 'eco-solver-local',
    enableJournaling: true,
  },
  redis: {
    connection: {
      host: 'localhost',
      port: 6379,
    },
    jobs: {
      //remove on complete/fail for dev so we can submit the same tx multiple times
      intentJobConfig: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    },
  },

  solverRegistrationConfig: {
    apiOptions: {
      baseUrl: 'http://localhost:4000',
    },
  },
}
