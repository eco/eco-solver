import { merge } from 'lodash'
import defaultConfig from './configs/default'
import developmentConfig from './configs/development'
import productionConfig from './configs/production'
import preproductionConfig from './configs/preproduction'
import stagingConfig from './configs/staging'
import testConfig from './configs/test'

const configs = {
  default: defaultConfig,
  development: developmentConfig,
  production: productionConfig,
  preproduction: preproductionConfig,
  staging: stagingConfig,
  test: testConfig,
}

type configKey = keyof typeof configs

export function getStaticSolverConfig(
  environment: configKey = (process.env['NODE_ENV'] as configKey) || 'development',
) {
  // Merge default config with environment-specific config
  if (environment === 'default' || environment === 'development') {
    return merge({}, defaultConfig, developmentConfig)
  }

  const envConfig = configs[environment]

  if (!envConfig) {
    throw new Error(`Configuration for environment "${environment}" not found`)
  }

  // Deep merge default config with environment config using lodash merge
  return merge({}, defaultConfig, envConfig)
}

export default getStaticSolverConfig()
