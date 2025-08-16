const { composePlugins, withNx } = require('@nx/webpack');
const webpack = require('webpack');
const path = require('path');
const dotenv = require('dotenv');

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envPath = path.resolve(context.root, `.env.${nodeEnv}`);
  
  const envResult = dotenv.config({ path: envPath });
  if (envResult.error && nodeEnv !== 'production') {
    console.warn(`Could not load environment file: ${envPath}`);
  }
  
  config.target = 'node';
  
  const nodeExternals = require('webpack-node-externals');
  config.externals = [nodeExternals()];
  
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.DefinePlugin({
      'process.env': JSON.stringify({
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || '3000',
        HOST: process.env.HOST || 'localhost',
        
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        LOG_CONSOLE: process.env.LOG_CONSOLE || 'true',
        LOG_FILE: process.env.LOG_FILE || 'false',
        
        API_PREFIX: process.env.API_PREFIX || '/api',
        API_VERSION: process.env.API_VERSION || 'v1'
      })
    })
  );
  
  if (options.watch) {
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
    config.entry = ['webpack/hot/poll?100', config.entry];
  }
  
  return config;
});
