const { composePlugins, withNx } = require('@nx/webpack');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const path = require('path');

module.exports = composePlugins(withNx(), (config) => {
  // Remove the default ForkTsChecker added by Nx, then add our own with exclusions
  config.plugins = config.plugins.filter(
    (p) => !(p && p.constructor && p.constructor.name === 'ForkTsCheckerWebpackPlugin')
  );

  config.plugins.push(
    new ForkTsCheckerWebpackPlugin({
      issue: {
        exclude: [
          { file: '**/node_modules/permissionless/**' },
        ],
      },
      typescript: {
        diagnosticOptions: { syntactic: true, semantic: true }
      }
    })
  );

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
      'class-validator': 'class-validator'
    },
  };
});