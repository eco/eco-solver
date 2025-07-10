import { ChainAddress } from '@/eco-configs/eco-config.types'
import { TokenBalance } from '../types'

export interface BalanceProvider {
  /**
   * Fetches the token balances for the given token addresses on the specified chain
   * @param chainID - The chain ID to fetch balances from
   * @param tokenAddresses - Array of token addresses to fetch balances for
   * @returns Record mapping token address to balance information
   */
  fetchTokenBalances(chainID: number, tokenAddresses: ChainAddress[]): Promise<Record<ChainAddress, TokenBalance>>

  /**
   * Fetches the token balances for a specific wallet on the given chain
   * @param chainID - The chain ID to fetch balances from
   * @param walletAddress - The wallet address to fetch balances for
   * @param tokenAddresses - Array of token addresses to fetch balances for
   * @returns Record mapping token address to balance information
   */
  fetchWalletTokenBalances(
    chainID: number,
    walletAddress: ChainAddress,
    tokenAddresses: ChainAddress[]
  ): Promise<Record<ChainAddress, TokenBalance>>

  /**
   * Gets the native token balance for the specified account
   * @param chainID - The chain ID to check the native balance on
   * @param account - The account type to check ('kernel' or 'eoc')
   * @returns The native token balance in base units
   */
  getNativeBalance(chainID: number, account: 'kernel' | 'eoc'): Promise<bigint>
}