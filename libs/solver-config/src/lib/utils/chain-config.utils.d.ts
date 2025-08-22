import { EcoChainConfig } from '@eco-foundation/routes-ts'
export declare const ChainPrefix = 'pre'
export declare enum NodeEnv {
  production = 'production',
  preproduction = 'preproduction',
  staging = 'staging',
  development = 'development',
}
export declare function getNodeEnv(): NodeEnv
export declare function isPreEnv(): boolean
export declare function getChainConfig(chainID: number | string): EcoChainConfig
