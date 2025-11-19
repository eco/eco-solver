import * as fs from 'fs';
import * as path from 'path';

import * as yaml from 'js-yaml';
import { Address } from 'viem';

/**
 * E2E Test Configuration Loader
 *
 * Loads configuration from test/config.e2e.yaml and provides typed accessor functions.
 * Config is already validated by the NestJS app, so we trust it here.
 *
 * All values are loaded dynamically from config - no hardcoded constants.
 */

// Load and parse the E2E config file
const CONFIG_PATH = path.join(__dirname, '../../config.e2e.yaml');
const configFileContents = fs.readFileSync(CONFIG_PATH, 'utf-8');
const config = yaml.load(configFileContents) as any;

/**
 * Get network configuration by chain ID
 */
function getNetworkConfig(chainId: number) {
  const network = config.evm.networks.find((n: any) => n.chainId === chainId);
  if (!network) {
    throw new Error(`Network configuration not found for chain ID ${chainId}`);
  }
  return network;
}

/**
 * Get RPC URL for a chain
 */
export function getRpcUrl(chainId: number): string {
  const network = getNetworkConfig(chainId);
  return network.rpc.urls[0];
}

/**
 * Get Portal contract address for a chain
 */
export function getPortalAddress(chainId: number): Address {
  const network = getNetworkConfig(chainId);
  return network.contracts.portal as Address;
}

/**
 * Get token address by symbol for a chain
 */
export function getTokenAddress(chainId: number, symbol: string): Address {
  const network = getNetworkConfig(chainId);
  const token = network.tokens.find((t: any) => t.symbol === symbol);
  if (!token) {
    throw new Error(`Token ${symbol} not found for chain ID ${chainId}`);
  }
  return token.address as Address;
}

/**
 * Get prover address by type for a chain
 */
export function getProverAddress(chainId: number, type: 'hyper' | 'polymer'): Address {
  const network = getNetworkConfig(chainId);
  const provers = network.provers as Record<string, string>;
  return provers[type] as Address;
}

/**
 * Get claimant (signer) address for a chain
 */
export function getClaimantAddress(chainId: number): Address {
  const network = getNetworkConfig(chainId);
  return network.claimant as Address;
}

/**
 * Kernel wallet signer address (claimant from config for Optimism)
 */
export const KERNEL_SIGNER_ADDRESS = getClaimantAddress(10);
