import { EcoChainConfig } from '@eco-foundation/routes-ts';
/**
 * The prefix for non-production deploys on a chain
 */
export declare const ChainPrefix = "pre";
export declare enum NodeEnv {
    production = "production",
    preproduction = "preproduction",
    staging = "staging",
    development = "development"
}
/**
 * Returns the NodeEnv enum value from the string node env, defaults to Development
 *
 * @param env the string node env
 * @returns
 */
export declare function getNodeEnv(): NodeEnv;
/**
 * @returns true if the node env is preproduction or development
 */
export declare function isPreEnv(): boolean;
/**
 * Gets the chain configuration for the given chain id from the
 * eco protocol addresses library
 * @param chainID the chain id
 * @returns
 */
export declare function getChainConfig(chainID: number | string): EcoChainConfig;
