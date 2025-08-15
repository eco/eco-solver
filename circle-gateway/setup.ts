import 'dotenv/config'
import {
  Account,
  Address,
  createPublicClient as viemCreatePublicClient,
  createWalletClient as viemCreateWalletClient,
  erc20Abi,
  http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { avalancheFuji, baseSepolia, sepolia } from 'viem/chains'
import { GatewayClient } from './gateway-client'
import { gatewayMinterAbi, gatewayWalletAbi } from './constants/abis'

// Chain IDs
export const SEPOLIA_CHAIN_ID = 11155111
export const BASE_SEPOLIA_CHAIN_ID = 84532
export const AVALANCHE_FUJI_CHAIN_ID = 43113

// Contract addresses
export const gatewayWalletAddress: Address = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9'
export const gatewayMinterAddress: Address = '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B'

// USDC addresses by chain ID
export const usdcAddresses: Record<number, Address> = {
  [SEPOLIA_CHAIN_ID]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  [BASE_SEPOLIA_CHAIN_ID]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  [AVALANCHE_FUJI_CHAIN_ID]: '0x5425890298aed601595a70ab815c96711a31bc65',
}

// Gateway domains by chain ID
export const gatewayDomains: Record<number, number> = {
  [SEPOLIA_CHAIN_ID]: 0,
  [BASE_SEPOLIA_CHAIN_ID]: 6,
  [AVALANCHE_FUJI_CHAIN_ID]: 1,
}

export { erc20Abi, gatewayMinterAbi, gatewayWalletAbi }

// Get chain by ID
function getChainById(chainId: number) {
  switch (chainId) {
    case SEPOLIA_CHAIN_ID:
      return sepolia
    case BASE_SEPOLIA_CHAIN_ID:
      return baseSepolia
    case AVALANCHE_FUJI_CHAIN_ID:
      return avalancheFuji
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`)
  }
}

export function createPublicClient(chainId: number) {
  const chain = getChainById(chainId)
  return viemCreatePublicClient({
    chain,
    transport: http(),
  })
}

export function createWalletClient(chainId: number, account: Account) {
  const chain = getChainById(chainId)
  return viemCreateWalletClient({
    account,
    chain,
    transport: http(),
  })
}

export function getChainInfo(chainId: number) {
  const chain = getChainById(chainId)
  return {
    chainId,
    name: chain.name,
    domain: gatewayDomains[chainId],
    currency: chain.nativeCurrency.symbol,
    usdcAddress: usdcAddresses[chainId],
  }
}

if (!process.env.PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY environment variable is not set')
}

export const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`)
export const gateway = new GatewayClient()
