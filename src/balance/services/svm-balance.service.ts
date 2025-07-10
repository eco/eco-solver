import { Injectable, Logger } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { TokenBalance } from '@/balance/types'
import { EcoError } from '@/common/errors/eco-error'
import { Cacheable } from '@/decorators/cacheable.decorator'
import { BalanceProvider } from '../interfaces/balance-provider.interface'
import { SvmMultichainClientService } from '@/transaction/svm-multichain-client.service'
import { Address as SvmAddress, Rpc, SolanaRpcApi } from '@solana/kit'
import { fetchToken, fetchMint, findAssociatedTokenPda } from '@solana-program/token'
import { ChainAddress } from '@/eco-configs/eco-config.types'

@Injectable()
export class SvmBalanceService implements BalanceProvider {
  private logger = new Logger(SvmBalanceService.name)

  constructor(
    private readonly svmMultichainClientService: SvmMultichainClientService,
  ) {}

  /**
   * Fetches the balances of the solver's wallet for the given tokens on Solana
   * @param chainID the chain id
   * @param tokenAddresses the tokens to fetch balances for (SPL token mint addresses)
   * @returns
   */
  @Cacheable()
  async fetchTokenBalances(
    chainID: number,
    tokenAddresses: ChainAddress[],
  ): Promise<Record<ChainAddress, TokenBalance>> {
    // TODO: Get actual wallet address from SVM client
    const walletAddress = this.getSolverWalletAddress(chainID)
    return this.fetchWalletTokenBalances(chainID, walletAddress, tokenAddresses)
  }

  /**
   * Fetches the token balances of a wallet for the given token list on Solana.
   * @param chainID the chain id
   * @param walletAddress wallet address (base58 encoded)
   * @param tokenAddresses the tokens to fetch balances for (SPL token mint addresses)
   * @returns
   */
  async fetchWalletTokenBalances(
    chainID: number,
    walletAddress: ChainAddress,
    tokenAddresses: ChainAddress[],
  ): Promise<Record<ChainAddress, TokenBalance>> {
    const rpc = await this.svmMultichainClientService.getRpc(chainID)
    const owner = walletAddress as SvmAddress

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `fetchWalletTokenBalances (SVM)`,
        properties: {
          chainID,
          tokenAddresses,
          walletAddress,
        },
      }),
    )

    const tokenBalances: Record<ChainAddress, TokenBalance> = {}

    for (const tokenAddress of tokenAddresses) {
      try {
        const mint = tokenAddress as SvmAddress
        
        // find the associated token account address
        const [associatedTokenPda] = await findAssociatedTokenPda({
          owner,
          mint,
          tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as SvmAddress,
        })

        // get mint information for decimals
        const mintInfo = await fetchMint(rpc, mint)
        
        // get token account information
        const tokenAccount = await fetchToken(rpc, associatedTokenPda)

        tokenBalances[tokenAddress] = {
          address: tokenAddress,
          balance: tokenAccount.data.amount,
          decimals: mintInfo.data.decimals,
        }
      } catch (error) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: `Failed to fetch balance for token ${tokenAddress}`,
            properties: {
              chainID,
              tokenAddress,
              walletAddress,
              error: error.message,
            },
          }),
        )
        
        // If account doesn't exist, set balance to 0
        tokenBalances[tokenAddress] = {
          address: tokenAddress,
          balance: 0n,
          decimals: 6, // Default to 6 decimals for USDC
        }
      }
    }

    return tokenBalances
  }

  /**
   * Gets the native SOL balance for the solver's wallet on Solana.
   * 
   * @param chainID - The chain ID to check the native balance on
   * @param account - The account type to check (for Solana, both map to the same wallet)
   * @returns The native SOL balance in lamports
   */
  @Cacheable()
  async getNativeBalance(chainID: number, account: 'kernel' | 'eoc'): Promise<bigint> {
    const rpc = await this.svmMultichainClientService.getRpc(chainID)
    const walletAddress = this.getSolverWalletAddress(chainID)
    
    try {
      const address = walletAddress as SvmAddress
      const balance = await rpc.getBalance(address).send()
      return BigInt(balance.value)
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Failed to fetch native balance`,
          properties: {
            chainID,
            walletAddress,
            error: error.message,
          },
        }),
      )
      return 0n
    }
  }

  /**
   * Gets the solver's wallet address for the given chain
   * @param chainID the chain id
   * @returns the wallet address
   */
  private getSolverWalletAddress(chainID: number): SvmAddress {
    // Get the wallet address from the SVM client service
    return this.svmMultichainClientService.getAddress()
  }
}