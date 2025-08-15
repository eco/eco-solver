import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Chain, Client, extractChain, parseUnits, Transport } from 'viem'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { EcoConfigService } from '@eco/infrastructure-config'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { convertViemChainToRelayChain, createClient, getClient } from '@reservoir0x/relay-sdk'
import { ChainsSupported } from '@eco/infrastructure-blockchain'
import { adaptKernelWallet } from './wallet-adapter'
import { KernelAccountClient } from '@zerodev/sdk/clients/kernelAccountClient'
import { SmartAccount } from 'viem/account-abstraction'

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

  getStrategy() {
    return 'Relay' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
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
        amount: parseUnits(swapAmount.toString(), tokenIn.balance.decimals).toString(),
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

      const slippage = 1 - Number(amountOut) / Number(amountIn)

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
          error: error instanceof Error ? error : new Error(String(error)),
          properties: {
            tokenIn: `${tokenIn.config.address} (${tokenIn.chainId})`,
            tokenOut: `${tokenOut.config.address} (${tokenOut.chainId})`,
            amount: swapAmount,
          },
        }),
      )
      throw error
    }
  }

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
          error: error instanceof Error ? error : new Error(String(error)),
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
