const { composePlugins, withNx } = require('@nx/webpack')
const path = require('path')

module.exports = composePlugins(withNx(), (config) => ({
  ...config,
  target: 'node',
  externals: [],
  output: {
    ...config.output,
    libraryTarget: 'commonjs2',
  },
  resolve: {
    ...config.resolve,
    extensions: ['.ts', '.js'],
    alias: {
      ...config.resolve?.alias,
      '@libs/eco-solver-config': path.resolve(
        __dirname,
        '../../libs/eco-solver/config/src/index.ts',
      ),
      '@eco-solver': path.resolve(__dirname, 'src'),
      // Ignore problematic dependencies
      '@0xsquid/squid-types': false,
      '@nestjs/microservices': false,
      '@nestjs/microservices/microservices-module': false,
      '@nestjs/websockets/socket-module': false,
      'class-transformer/storage': false,
      '@mikro-orm/core': false,
      '@nestjs/sequelize/dist/common/sequelize.utils': false,
      '@nestjs/typeorm/dist/common/typeorm.utils': false,
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /\.d\.ts$/, /\.js\.map$/],
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          configFile: path.resolve(__dirname, '../../tsconfig.base.json'),
        },
      },
      // Ignore .d.ts files and .js.map files completely
      {
        test: /\.(d\.ts|js\.map)$/,
        loader: 'ignore-loader',
      },
    ],
  },
  ignoreWarnings: [
    // Ignore optional dependency warnings
    /Can't resolve '@0xsquid\/squid-types'/,
    /Can't resolve '@nestjs\/microservices'/,
    /Can't resolve '@nestjs\/websockets'/,
    /Can't resolve 'class-transformer\/storage'/,
    /Can't resolve '@mikro-orm\/core'/,
    /Can't resolve '@nestjs\/sequelize'/,
    /Can't resolve '@nestjs\/typeorm'/,
    // Ignore critical dependency warnings from NestJS dynamic imports
    /Critical dependency: the request of a dependency is an expression/,
  ],
}))
