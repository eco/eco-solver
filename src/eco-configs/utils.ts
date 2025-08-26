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
  return (
    getNodeEnv() === NodeEnv.preproduction ||
    getNodeEnv() === NodeEnv.development ||
    getNodeEnv() === NodeEnv.staging
  )
}

/**
 * Gets the chain configuration for the given chain id from the
 * eco protocol addresses library
 * @param chainID the chain id
 * @returns
 */
export function getChainConfig(chainID: number | string): EcoChainConfig {
  const id = isPreEnv() ? `${chainID}-${ChainPrefix}` : chainID.toString()
  if (id === 'base-pre') {
    return {
      IntentSource: "0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7",
      Inbox: "0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7",
      MetaProver: '0x0000000000000000000000000000000000000000',
      HyperProver: '0xd1fD3527E3Dc99e34D5ecE8063D9B4AcC82669d0',
    }
  } else if (id === '10-pre') {
    return {
      IntentSource: "0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7",
      Inbox: "0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7",
      MetaProver: '0x0000000000000000000000000000000000000000',
      HyperProver: '0xC09483299100ab9960eA1F641b0f94B9E6e0923C',
    }
  }
  const config = EcoProtocolAddresses[id]
  if (config === undefined) {
    throw EcoError.ChainConfigNotFound(id)
  }
  return config
}
