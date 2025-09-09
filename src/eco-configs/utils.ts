import { EcoProtocolAddresses } from '@eco-foundation/routes-ts'
import { Address } from './eco-config.types'
import { EcoChainConfig, getVmType, VmType } from './eco-config.types'
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
  const vm = getVmType(Number(chainID))
  if (vm === VmType.EVM) {
    return getAddress(address as EvmAddress)
  } else return address
}

/**
 * Gets the chain configuration for the given chain id from the
 * eco protocol addresses library
 * @param chainID the chain id
 * @returns
 */
export function getChainConfig(chainID: number | string): EcoChainConfig {
  const id = isPreEnv() ? `${chainID}-${ChainPrefix}` : chainID.toString()
  console
  if (id === '1399811149-pre') {
    return {
      IntentSource: new PublicKey('6c4yNBMyjP8C4EC7KNwxouQdSKoDMA2i7jXzYgqw56eX'),
      Inbox: new PublicKey('6c4yNBMyjP8C4EC7KNwxouQdSKoDMA2i7jXzYgqw56eX'),
      MetaProver: '0x0000000000000000000000000000000000000000',
      HyperProver: new PublicKey('DuZmeMYwc3tagKxQu2ZbRY7xoSsosFfjx5TNmWafCrkU'),
    }
  } else if (id === '10-pre') {
    return {
      IntentSource: '0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7',
      Inbox: '0x90F0c8aCC1E083Bcb4F487f84FC349ae8d5e28D7',
      MetaProver: '0x0000000000000000000000000000000000000000',
      HyperProver: '0xde255Aab8e56a6Ae6913Df3a9Bbb6a9f22367f4C',
    }
  }
  const config = EcoProtocolAddresses[id]
  if (config === undefined) {
    throw EcoError.ChainConfigNotFound(id)
  }
  return config
}
