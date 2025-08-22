import { EcoChainConfig, EcoProtocolAddresses } from '@eco-foundation/routes-ts'

export const ChainPrefix = 'pre'

export enum NodeEnv {
  production = 'production',
  preproduction = 'preproduction',
  staging = 'staging',
  development = 'development',
}

export function getNodeEnv(): NodeEnv {
  const env: string = process.env['NODE_ENV'] || 'development'
  const normalizedEnv = env.toLowerCase() as keyof typeof NodeEnv
  return NodeEnv[normalizedEnv] || NodeEnv.development
}

export function isPreEnv(): boolean {
  return (
    getNodeEnv() === NodeEnv.preproduction ||
    getNodeEnv() === NodeEnv.development ||
    getNodeEnv() === NodeEnv.staging
  )
}

export function getChainConfig(chainID: number | string): EcoChainConfig {
  const id = isPreEnv() ? `${chainID}-${ChainPrefix}` : chainID.toString()
  const config = (EcoProtocolAddresses as any)[id]
  if (config === undefined) {
    throw new Error(`Chain config not found for ${id}`)
  }
  return config
}
