import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Chain, Client, extractChain, Transport } from 'viem'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { convertViemChainToRelayChain, createClient, getClient } from '@reservoir0x/relay-sdk'
import { ChainsSupported } from '@/common/chains/supported'
import { adaptKernelWallet } from './wallet-adapter'
import { KernelAccountClient } from '@zerodev/sdk/clients/kernelAccountClient'
import { SmartAccount } from 'viem/account-abstraction'
import { getSlippagePercent } from '@/liquidity-manager/utils/math'

@Injectable()
export class RelayProviderService implements OnModuleInit, IRebalanceProvider<'Relay'> {
  private logger = new Logger(RelayProviderService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientV2Service,
  ) {}

  async onModuleInit() {
    // Configure Relay SDK
    const chains = this.getRelayChains()

    createClient({
      source: 'eco-protocol',
      chains,
    })
  }

  /**
   * Gets the strategy type this provider implements
   * @returns The strategy enum value
   */
  getStrategy() {
    return 'Relay' as const
  }

  /**
   * Gets a quote for swapping tokens using the Relay strategy
   * @param tokenIn - The input token data including address, decimals, and chain information
   * @param tokenOut - The output token data including address, decimals, and chain information
   * @param swapAmountBased - The amount to swap that has already been normalized to the base token's decimals
   *                          using {@link normalizeBalanceToBase} with {@link BASE_DECIMALS} (18 decimals).
   *                          This represents the tokenIn amount and is ready for direct use in swap calculations.
   * @param id - Optional identifier for tracking the quote request
   * @returns A promise resolving to a single Relay rebalance quote
   */
  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmountBased: bigint,
    id?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<RebalanceQuote<'Relay'>> {
    try {
      const client: KernelAccountClient<Transport, Chain, SmartAccount, Client> =
        await this.kernelAccountClientService.getClient(tokenIn.chainId)
      const walletAddress = await this.kernelAccountClientService.getAddress()

      // Adapt the kernel wallet to a Relay-compatible wallet
      const adaptedWallet = adaptKernelWallet(client, (chainId) =>
        this.kernelAccountClientService.getClient(chainId),
      )

      const relayQuote = await getClient()?.actions.getQuote({
        chainId: tokenIn.chainId,
        toChainId: tokenOut.chainId,
        currency: tokenIn.config.address,
        toCurrency: tokenOut.config.address,
        amount: swapAmountBased.toString(),
        wallet: adaptedWallet,
        tradeType: 'EXACT_INPUT',
        user: walletAddress,
        recipient: walletAddress,
      })

      // Calculate amount out and slippage
      const amountIn = relayQuote.details?.currencyIn?.amount
      const amountOut = relayQuote.details?.currencyOut?.minimumAmount

      if (!relayQuote.details || !amountIn || !amountOut) {
        throw EcoError.RebalancingRouteNotFound()
      }

      const dstTokenMin = {
        address: tokenOut.config.address,
        decimals: tokenOut.balance.decimals,
        balance: BigInt(amountOut),
      }
      const srcToken = {
        address: tokenIn.config.address,
        decimals: tokenIn.balance.decimals,
        balance: BigInt(amountIn),
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)

      return {
        slippage,
        tokenIn,
        tokenOut,
        amountIn: BigInt(amountIn),
        amountOut: BigInt(amountOut),
        strategy: this.getStrategy(),
        context: relayQuote,
      }
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'Failed to get Relay quote',
          error,
          properties: {
            tokenIn: `${tokenIn.config.address} (${tokenIn.chainId})`,
            tokenOut: `${tokenOut.config.address} (${tokenOut.chainId})`,
            amount: swapAmountBased,
          },
        }),
      )
      throw error
    }
  }

  /**
   * Executes a rebalance swap using the provided quote
   * @param walletAddress - The wallet address to execute the swap from
   * @param quote - The rebalance quote containing swap parameters and strategy details
   * @returns A promise resolving to the execution result
   */
  async execute(walletAddress: string, quote: RebalanceQuote<'Relay'>): Promise<unknown> {
    try {
      const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

      // Verify the wallet matches the configured one
      if (client.account!.address !== walletAddress) {
        throw new Error('Wallet address mismatch for Relay execution')
      }

      this.logger.debug(
        EcoLogMessage.fromDefault({
          message: 'RelayProviderService: executing quote',
          properties: {
            tokenIn: quote.tokenIn.config.address,
            chainIn: quote.tokenIn.chainId,
            tokenOut: quote.tokenOut.config.address,
            chainOut: quote.tokenOut.chainId,
            amountIn: quote.amountIn.toString(),
            amountOut: quote.amountOut.toString(),
            slippage: quote.slippage,
          },
        }),
      )

      // Adapt the kernel wallet to a Relay-compatible wallet
      const adaptedWallet = adaptKernelWallet(client, (chainId) =>
        this.kernelAccountClientService.getClient(chainId),
      )

      // Execute the quote
      return await getClient()?.actions.execute({
        quote: quote.context,
        wallet: adaptedWallet,
        onProgress: (data) => {
          this.logger.debug(
            EcoLogMessage.fromDefault({
              message: 'Relay execution progress',
              properties: { data },
            }),
          )
        },
      })
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withError({
          message: 'Failed to execute Relay quote',
          error,
          properties: {
            tokenIn: `${quote.tokenIn.config.address} (${quote.tokenIn.chainId})`,
            tokenOut: `${quote.tokenOut.config.address} (${quote.tokenOut.chainId})`,
            amount: quote.amountIn.toString(),
          },
        }),
      )
      throw error
    }
  }

  private getRelayChains() {
    return this.ecoConfigService
      .getSupportedChains()
      .map((chain) =>
        convertViemChainToRelayChain(extractChain({ chains: ChainsSupported, id: Number(chain) })),
      )
  }
}
