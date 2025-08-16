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
        
        DB_HOST: process.env.DB_HOST || 'localhost',
        DB_PORT: process.env.DB_PORT || '5432',
        DB_USERNAME: process.env.DB_USERNAME || 'postgres',
        DB_PASSWORD: process.env.DB_PASSWORD || 'password',
        DB_DATABASE: process.env.DB_DATABASE || 'eco_solver_dev',
        DB_SSL: process.env.DB_SSL || 'false',
        
        LOG_LEVEL: process.env.LOG_LEVEL || 'info',
        LOG_CONSOLE: process.env.LOG_CONSOLE || 'true',
        LOG_FILE: process.env.LOG_FILE || 'false',
        
        API_PREFIX: process.env.API_PREFIX || '/api',
        API_VERSION: process.env.API_VERSION || 'v1',
        CORS_ENABLED: process.env.CORS_ENABLED || 'true',
        CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
        
        JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key',
        JWT_EXPIRATION: process.env.JWT_EXPIRATION || '1h',
        BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS || '10'
      })
    })
  );
  
  if (options.watch) {
    config.plugins.push(new webpack.HotModuleReplacementPlugin());
    config.entry = ['webpack/hot/poll?100', config.entry];
  }
  
  return config;
});
