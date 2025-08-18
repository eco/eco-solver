const { composePlugins, withNx } = require('@nx/webpack');
const path = require('path');

module.exports = composePlugins(withNx(), (config) => {
  return {
    ...config,
    target: 'node',
    output: {
      ...config.output,
      clean: true,
    },
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,
        '@': path.resolve(__dirname, 'src'),
      },
      fallback: {
        fs: false,
        path: false,
      },
    },
    externals: {
      // Mark these as external so they're not bundled
      '@nestjs/microservices': '@nestjs/microservices',
      '@nestjs/websockets/socket-module': '@nestjs/websockets/socket-module',
      'cache-manager': 'cache-manager',
      'class-transformer': 'class-transformer',
      'class-validator': 'class-validator',
    },
  };
});