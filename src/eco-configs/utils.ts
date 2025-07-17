import { EcoProtocolAddresses } from '@eco-foundation/routes-ts'
import { ChainAddress, EcoChainConfig, getVMType, VMType } from './eco-config.types'
import * as config from 'config'
import { EcoError } from '../common/errors/eco-error'
import { Address as SvmAddress } from '@solana/kit'
import { Address as EvmAddress, getAddress } from 'viem'

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

export function getChainAddress(chainID: number, address: ChainAddress): ChainAddress {
  const vm = getVMType(chainID)
  if (vm === VMType.EVM) {
    return getAddress(address as EvmAddress)
  } else 
  return getChainConfig(chainID).IntentSource
}

/**
 * Gets the chain configuration for the given chain id from the
 * eco protocol addresses library
 * @param chainID the chain id
 * @returns
 */
export function getChainConfig(chainID: number | string): EcoChainConfig {
  const id = isPreEnv() ? `${chainID}-${ChainPrefix}` : chainID.toString()
  if (id === '1399811150-pre') {
    return {
      IntentSource: 'B8Z2Sv1zspyQbAa4VWGCbq88cyUfw5G1HKgsxQDM1uF7' as SvmAddress,
      Inbox: 'B8Z2Sv1zspyQbAa4VWGCbq88cyUfw5G1HKgsxQDM1uF7' as SvmAddress,
      HyperProver: '8bvpmgp9xbGngm9KmfX5poJer8dW4BJb7LaxuSmfCPZz' as SvmAddress,
      MetaProver: '0x0000000000000000000000000000000000000000'
    }
  }
  const config = EcoProtocolAddresses[id]
  if (config === undefined) {
    throw EcoError.ChainConfigNotFound(id)
  }
  return config
}
