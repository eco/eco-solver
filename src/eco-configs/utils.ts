import { EcoChainConfig, EcoProtocolAddresses } from '@eco-foundation/routes-ts'
import * as config from 'config'
import { EcoError } from '../common/errors/eco-error'
import { EcoConfigType, EcoConfigBase6Keys } from './eco-config.types'
import { convertNormScalar } from '@/fee/utils'

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
  if (config === undefined) {
    throw EcoError.ChainConfigNotFound(id)
  }
  return config
}

/**
 * Recursively traverses an object (including nested objects and arrays) and applies
 * a conversion function to values whose keys are in the provided keySet.
 * 
 * @param obj - The object to traverse
 * @param keySet - Set of keys to match for conversion
 * @param converter - Function to convert the matched values
 * @returns A new object with converted values
 */
export function recursiveConvertByKeys<T = any>(
  obj: any,
  keySet: Set<string>,
  converter: (value: any, key: string) => any
): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => recursiveConvertByKeys(item, keySet, converter)) as T
  }

  // Handle objects
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (keySet.has(key)) {
      // Convert the value if the key matches
      result[key] = converter(value, key)
    } else if (value !== null && typeof value === 'object') {
      // Recursively process nested objects/arrays
      result[key] = recursiveConvertByKeys(value, keySet, converter)
    } else {
      // Keep primitive values as-is
      result[key] = value
    }
  }
  return result as T
}

/**
 * Normalizes EcoConfig values from base 6 to base 18 for specific keys.
 * Converts values by multiplying by 10^12 (adding 12 zeros) for keys in EcoConfigBase6Keys.
 * 
 * @param config - The EcoConfig object to normalize
 * @returns A new EcoConfig object with normalized values
 */
export function recursiveConfigNormalizer<T>(config: T): T {
  const base6KeySet = new Set(EcoConfigBase6Keys)
  
  const converter = (value: any, key: string): any => {
    // Convert numeric values from base 6 to base 18 by multiplying by 10^12
    if (typeof value === 'number' || typeof value === 'bigint') {
      return convertNormScalar(BigInt(value), 6)
    }
    return value
  }

  return recursiveConvertByKeys<T>(config, base6KeySet, converter)
}
