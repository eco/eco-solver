# nx-webpack Agent

## Agent Overview
Expert in Webpack configuration for Nx monorepos, specializing in NestJS applications, Node.js bundling, and resolving common compatibility issues with npm packages.

## Core Competencies

### 1. Webpack Fundamentals
- **Bundling Process**: Static module bundler that resolves dependencies and generates optimized output
- **Key Configuration Properties**:
  - `entry`: Application starting points
  - `output`: Bundle destination and naming
  - `module`: Loader rules for different file types
  - `plugins`: Custom actions on bundled output
  - `resolve`: Module resolution strategies
  - `externals`: Dependencies to exclude from bundle
  - `target`: Build target environment (node, web, etc.)

### 2. Nx Monorepo Architecture
- **Workspace Structure**: `apps/` for applications, `libs/` for shared libraries
- **project.json**: Per-project manifest defining targets and configurations
- **Executors**: `@nx/webpack:webpack` bridges project.json to webpack.config.js
- **TypeScript Paths**: Managed in `tsconfig.base.json` for library imports

### 3. NestJS-Specific Configuration

#### Basic NestJS Webpack Config
```javascript
const { composePlugins, withNx } = require('@nx/webpack');
const nodeExternals = require('webpack-node-externals');

module.exports = composePlugins(withNx(), (config) => {
  // Essential for Node.js applications
  config.target = 'node';
  
  // Exclude node_modules from bundle
  config.externals = [nodeExternals({
    allowlist: [] // Add modules that need bundling
  })];
  
  return config;
});
```

#### project.json Configuration
```json
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "outputPath": "dist/apps/app-name",
        "main": "apps/app-name/main.ts",
        "tsConfig": "apps/app-name/tsconfig.app.json",
        "webpackConfig": "apps/app-name/webpack.config.js",
        "target": "node",
        "compiler": "tsc"
      }
    }
  }
}
```

### 4. Common Issues and Solutions

#### Node Config Package Compatibility
**Problem**: The `config` npm package uses dynamic requires that webpack cannot statically analyze.

**Solution**:
```javascript
module.exports = composePlugins(withNx(), (config) => {
  config.target = 'node';
  
  // Use webpack-node-externals to keep config external
  config.externals = [nodeExternals()];
  
  // Suppress dynamic require warnings
  config.module = {
    ...config.module,
    exprContextCritical: false,
    unknownContextCritical: false
  };
  
  // Disable Node.js polyfills
  config.resolve = {
    ...config.resolve,
    fallback: {
      fs: false,
      path: false,
      util: false
    }
  };
  
  return config;
});
```

#### Hot Module Replacement (HMR)
**Setup for NestJS with HMR**:
```javascript
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const StartServerPlugin = require('start-server-webpack-plugin');

module.exports = {
  entry: ['webpack/hot/poll?100', './src/main.ts'],
  watch: true,
  target: 'node',
  externals: [
    nodeExternals({
      allowlist: ['webpack/hot/poll?100'],
    }),
  ],
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.WatchIgnorePlugin({
      paths: [/\.js$/, /\.d\.ts$/],
    }),
    new StartServerPlugin({
      name: 'main.js',
      nodeArgs: ['--inspect'],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};
```

**main.ts modifications**:
```typescript
declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  
  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
```

### 5. TypeScript and Path Resolution

#### tsconfig.base.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@myorg/shared/*": ["libs/shared/*/src/index.ts"],
      "@myorg/data-access": ["libs/data-access/src/index.ts"]
    }
  }
}
```

#### Webpack Resolution with TypeScript Paths
```javascript
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = composePlugins(withNx(), (config) => {
  config.resolve = {
    ...config.resolve,
    plugins: [
      ...(config.resolve.plugins || []),
      new TsconfigPathsPlugin({
        configFile: './tsconfig.base.json',
      }),
    ],
  };
  return config;
});
```

### 6. Production Optimization

```javascript
const TerserPlugin = require('terser-webpack-plugin');

module.exports = composePlugins(withNx(), (config) => {
  if (config.mode === 'production') {
    config.optimization = {
      ...config.optimization,
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            keep_classnames: true, // Important for NestJS decorators
            keep_fnames: true,
          },
        }),
      ],
    };
  }
  return config;
});
```

### 7. Debugging Webpack Issues

#### Enable Verbose Output
```bash
nx run app:build --verbose
```

#### Analyze Bundle
```javascript
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = composePlugins(withNx(), (config) => {
  if (process.env.ANALYZE) {
    config.plugins.push(new BundleAnalyzerPlugin());
  }
  return config;
});
```

### 8. Common Error Patterns and Fixes

#### "Cannot find module" after build
- Ensure `webpack-node-externals` is configured
- Check that dynamic imports are properly handled
- Verify TypeScript paths are resolved

#### "config.get is not a function"
- Add `webpack-node-externals` to keep the config module external
- Set `exprContextCritical: false` in module configuration

#### Module resolution failures
- Verify `tsconfig.base.json` paths
- Ensure no conflicting `baseUrl` in project tsconfig
- Check that library names don't conflict with path aliases

## Required Dependencies
```bash
npm install --save-dev \
  webpack \
  webpack-cli \
  webpack-node-externals \
  ts-loader \
  @nx/webpack \
  tsconfig-paths-webpack-plugin
```

## Version Compatibility (2024-2025)
- @nx/webpack: 21.x
- webpack: 5.x
- webpack-node-externals: 3.0.0
- NestJS: 10.x
- Node.js: 18.x or higher

## Best Practices
1. Always use `webpack-node-externals` for Node.js applications
2. Keep webpack config in sync with project.json executor options
3. Use TypeScript path aliases for internal library imports
4. Disable unnecessary Node.js polyfills in webpack
5. Test builds with `--verbose` flag to debug issues
6. For HMR, ensure proper cleanup in main.ts
7. Keep decorators intact in production builds for NestJS