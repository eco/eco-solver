import { adaptKernelWallet } from './wallet-adapter'
import { Chain, Client, extractChain, parseUnits, Transport } from 'viem'
import { ChainsSupported } from '@/common/chains/supported'
import { convertViemChainToRelayChain, createClient, getClient } from '@reservoir0x/relay-sdk'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { KernelAccountClient } from '@zerodev/sdk/clients/kernelAccountClient'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { SmartAccount } from 'viem/account-abstraction'
import { LmTxGatedKernelAccountClientV2Service } from '../../../wallet-wrappers/kernel-gated-client-v2.service'

@Injectable()
export class RelayProviderService implements OnModuleInit, IRebalanceProvider<'Relay'> {
  private logger = new Logger(RelayProviderService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: LmTxGatedKernelAccountClientV2Service,
    private readonly rebalanceRepository: RebalanceRepository,
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
    id?: string,
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
        options: {
          slippageTolerance: this.ecoConfigService.getLiquidityManagerMaxQuoteSlippageBps(),
        },
      })

      // Calculate amount out and slippage
      const amountIn = relayQuote.details?.currencyIn?.amount
      const amountOut = relayQuote.details?.currencyOut?.minimumAmount

      if (!relayQuote.details || !amountIn || !amountOut) {
        this.logger.error(
          EcoLogMessage.withId({
            id,
            message: 'RelayProviderService: quote details not found',
            properties: { relayQuote, id },
          }),
        )
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
        EcoLogMessage.withErrorAndId({
          id,
          message: 'Failed to get Relay quote',
          error,
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
        EcoLogMessage.withId({
          id: quote.id,
          message: 'RelayProviderService: executing quote',
          properties: {
            quote,
          },
        }),
      )

      // Adapt the kernel wallet to a Relay-compatible wallet
      const adaptedWallet = adaptKernelWallet(client, (chainId) =>
        this.kernelAccountClientService.getClient(chainId),
      )

      // Execute the quote
      const res = await getClient()?.actions.execute({
        quote: quote.context,
        wallet: adaptedWallet,
        onProgress: (data) => {
          this.logger.debug(
            EcoLogMessage.withId({
              id: quote.id,
              message: 'Relay execution progress',
              properties: { data },
            }),
          )
        },
      })

      this.logger.debug(
        EcoLogMessage.withId({
          id: quote.id,
          message: 'Relay execution result',
          properties: { res },
        }),
      )

      await this.rebalanceRepository.updateStatus(quote.rebalanceJobID!, RebalanceStatus.COMPLETED)
      return res
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          id: quote.id,
          message: 'Failed to execute Relay quote',
          error,
          properties: {
            quote,
          },
        }),
      )

      await this.rebalanceRepository.updateStatus(quote.rebalanceJobID!, RebalanceStatus.FAILED)
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
