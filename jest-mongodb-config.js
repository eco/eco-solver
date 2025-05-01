module.exports = {
  mongodbMemoryServerOptions: {
    binary: {
      version: '6.0.9',
      skipMD5: true,
      downloadDir: '~/.cache/mongodb-binaries', // 👈 Force use of local cache
    },
    autoStart: false,
    instance: {
      // dbName: 'jest',
      storageEngine: 'wiredTiger',
    },
  },
}
