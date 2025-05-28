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
  const config = EcoProtocolAddresses[id]
  if (id === '33111') {
    return {
      IntentSource: '0x478AA4042b267139055632cd5A1Eb9Eb13b3Eeaf',
      Inbox: '0xB5DB3d430565cb399E05562f5638f31d19AE70b3',
      HyperProver: '0x8a3B3A803667092CECb3b269e71c5E5e16a9Db93',
      MetaProver: '0x0000000000000000000000000000000000000000',
    }
  }
  if (id === '3441006') {
    return {
      IntentSource: '0x478AA4042b267139055632cd5A1Eb9Eb13b3Eeaf',
      Inbox: '0xB5DB3d430565cb399E05562f5638f31d19AE70b3',
      HyperProver: '0x8a3B3A803667092CECb3b269e71c5E5e16a9Db93',
      MetaProver: '0x0000000000000000000000000000000000000000',
    }
  }
  if (config === undefined) {
    throw EcoError.ChainConfigNotFound(id)
  }
  return config
}
