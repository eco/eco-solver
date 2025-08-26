import { Injectable, Logger } from '@nestjs/common'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { TokenBalance } from '@/balance/types'
import { EcoError } from '@/common/errors/eco-error'
import { Cacheable } from '@/decorators/cacheable.decorator'
import { BalanceProvider } from '../interfaces/balance-provider.interface'
import { SvmMultichainClientService } from '@/transaction/svm-multichain-client.service'
import { PublicKey } from '@solana/web3.js'
import { 
  getAssociatedTokenAddress, 
  getAccount, 
  getMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID 
} from '@solana/spl-token'
import { Address, SerializableAddress, VmType } from '@eco-foundation/routes-ts'

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
  async fetchTokenBalances(
    chainID: number,
    tokenAddresses: Address<VmType.SVM>[],
  ): Promise<Record<SerializableAddress<VmType.SVM>, TokenBalance>> {
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
    walletAddress: Address<VmType.SVM>,
    tokenAddresses: Address<VmType.SVM>[],
  ): Promise<Record<SerializableAddress<VmType.SVM>, TokenBalance>> {
    const connection = await this.svmMultichainClientService.getConnection(chainID)

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

    const tokenBalances: Record<SerializableAddress<VmType.SVM>, TokenBalance> = {}

    for (const tokenAddress of tokenAddresses) {
      try {
        const mint = tokenAddress.toString()
        const mintPubkey = new PublicKey(mint)
        
        // find the associated token account address
        const associatedTokenAddress = await getAssociatedTokenAddress(
          mintPubkey,
          walletAddress,
          false, // allowOwnerOffCurve
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )

        // get mint information for decimals
        const mintInfo = await getMint(connection, mintPubkey)
        
        // get token account information
        const tokenAccount = await getAccount(connection, associatedTokenAddress)

        tokenBalances[tokenAddress.toString()] = {
          address: tokenAddress,
          balance: tokenAccount.amount,
          decimals: mintInfo.decimals,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorType = error?.constructor?.name || 'Unknown'
        
        if (errorType === 'TokenAccountNotFoundError') {
          // This is normal - token account doesn't exist until first tokens are received
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: `Token account not found for ${tokenAddress} (balance: 0)`,
              properties: {
                chainID,
                tokenAddress,
                walletAddress,
                reason: 'Associated Token Account not yet created',
              },
            }),
          )
        } else {
          // Log unexpected errors as warnings
          this.logger.warn(
            EcoLogMessage.fromDefault({
              message: `Failed to fetch balance for token ${tokenAddress}`,
              properties: {
                chainID,
                tokenAddress,
                walletAddress,
                error: errorMessage,
                errorType,
              },
            }),
          )
        }
        
        // If account doesn't exist, set balance to 0
        tokenBalances[tokenAddress.toString()] = {
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
  async getNativeBalance(chainID: number, address: Address<VmType.SVM>): Promise<bigint> {
    const connection = await this.svmMultichainClientService.getConnection(chainID)
    const walletAddress = this.getSolverWalletAddress(chainID)
    
    try {
      const pubkey = new PublicKey(walletAddress.toString())
      const balance = await connection.getBalance(pubkey)
      return BigInt(balance)
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
  private getSolverWalletAddress(chainID: number): Address<VmType.SVM> {
    // Get the wallet address from the SVM client service
    return this.svmMultichainClientService.getAddress()
  }
}