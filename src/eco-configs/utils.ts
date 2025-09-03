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
  console
  if (id === '1399811149-pre') {
    return {
      IntentSource: new PublicKey('HtYxMCpzoLx6tWgzzRDhiamqYCsGtANMLdwtX4PVgXX3'),
      Inbox: new PublicKey('HtYxMCpzoLx6tWgzzRDhiamqYCsGtANMLdwtX4PVgXX3'),
      MetaProver: '0x0000000000000000000000000000000000000000',
      HyperProver: new PublicKey('DuZmeMYwc3tagKxQu2ZbRY7xoSsosFfjx5TNmWafCrkU'),
    }
  } else if (id === '10-pre') {
    return {
      IntentSource: "0xae890b7d63c7e1c814bd45bc8ccec5e166f505c7",
      Inbox: "0xae890b7d63c7e1c814bd45bc8ccec5e166f505c7",
      MetaProver: '0x0000000000000000000000000000000000000000',
      HyperProver: '0x9523b6c0cAaC8122DbD5Dd1c1d336CEBA637038D',
    }
  }
  const config = EcoProtocolAddresses[id]
  if (config === undefined) {
    throw EcoError.ChainConfigNotFound(id)
  }
  return config
}
