import { EcoChainConfig, EcoProtocolAddresses } from '@eco-foundation/routes-ts'
import * as config from 'config'
import { EcoError } from '../common/errors/eco-error'

/**
 * The prefix for non-production deploys on a chain
 */
export const ChainPrefix = 'pre'

export enum NodeEnv {
  production = 'production',
  preproduction = 'preproduction',
  staging = 'staging',
  development = 'development',
}

/**
 * Returns the NodeEnv enum value from the string node env, defaults to Development
 *
 * @param env the string node env
 * @returns
 */
export function getNodeEnv(): NodeEnv {
  const env: string = config.util.getEnv('NODE_ENV')
  const normalizedEnv = env.toLowerCase() as keyof typeof NodeEnv
  return NodeEnv[normalizedEnv] || NodeEnv.development
}

/**
 * @returns true if the node env is preproduction or development
 */
export function isPreEnv(): boolean {
  return false
  // return (
  //   getNodeEnv() === NodeEnv.preproduction ||
  //   getNodeEnv() === NodeEnv.development ||
  //   getNodeEnv() === NodeEnv.staging
  // )
}

/**
 * Gets the chain configuration for the given chain id from the
 * eco protocol addresses library
 * @param chainID the chain id
 * @returns
 */
export function getChainConfig(chainID: number | string): EcoChainConfig {
  const id = isPreEnv() ? `${chainID}-${ChainPrefix}` : chainID.toString()
  return getCalderaChainConfig()
  // const config = EcoProtocolAddresses[id]
  // if (config === undefined) {
  //   throw EcoError.ChainConfigNotFound(id)
  // } else {
  //   return CALDERA_CHAIN_CONFIG
  // }
}

function getCalderaChainConfig(): EcoChainConfig {
  const env = getNodeEnv()
  if (env === NodeEnv.production) {
    return {
      IntentSource: '0x192b12FAB612AB8c54f4B416500Ea71CF61a9473',
      Inbox: '0xCB96D5Db5071b3335F8DB5a97BC90E274AAe24bF',
      HyperProver: '0x0000000000000000000000000000000000000000',
      MetaProver: '0x83C09c0C0579C23A6acEFD6a2b6285Bcec904207',
    }
  } else {
    return {
      IntentSource: '0x50673016E0720d6B7FA5Af3290709Fc8bAF65A70',
      Inbox: '0xCc71EA5C67795EF12be2328C14F7E96A39D71067',
      HyperProver: '0x0000000000000000000000000000000000000000',
      MetaProver: '0xcF415cFD2f287Ea5e394BAA1f12035fC57d6EED8',
    }
  }
}
