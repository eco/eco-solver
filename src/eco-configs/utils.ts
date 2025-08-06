import { Address, EcoProtocolAddresses } from '@eco-foundation/routes-ts'
import { EcoChainConfig, getVMType, VMType } from './eco-config.types'
import * as config from 'config'
import { EcoError } from '../common/errors/eco-error'
import { Address as EvmAddress, getAddress } from 'viem'
import { PublicKey } from '@solana/web3.js'

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

export function getChainAddress(chainID: number | bigint, address: Address): Address {
  const vm = getVMType(Number(chainID))
  if (vm === VMType.EVM) {
    return getAddress(address as EvmAddress)
  } else 
  return address
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
      IntentSource: new PublicKey('64Xrmg8iLpvW6ohBcjubTqXe56iNYqRi52yrnMfnbaA6'),
      Inbox: new PublicKey('64Xrmg8iLpvW6ohBcjubTqXe56iNYqRi52yrnMfnbaA6'),
      MetaProver: '0x0000000000000000000000000000000000000000',
      HyperProver: new PublicKey('B4pMQaAGPZ7Mza9XnDxJfXZ1cUa4aa67zrNkv8zYAjx4'),
    }
  }
  const config = EcoProtocolAddresses[id]
  if (config === undefined) {
    throw EcoError.ChainConfigNotFound(id)
  }
  return config
}
