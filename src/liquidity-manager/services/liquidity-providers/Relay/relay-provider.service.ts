import { adaptKernelWallet } from './wallet-adapter'
import { Chain, Client, extractChain, parseUnits, Transport } from 'viem'
import { ChainsSupported } from '@/common/chains/supported'
import { convertViemChainToRelayChain, createClient, getClient } from '@reservoir0x/relay-sdk'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { KernelAccountClient } from '@zerodev/sdk/clients/kernelAccountClient'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { SmartAccount } from 'viem/account-abstraction'

@Injectable()
export class RelayProviderService implements OnModuleInit, IRebalanceProvider<'Relay'> {
  private logger = new LiquidityManagerLogger('RelayProviderService')

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientV2Service,
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

  @LogOperation('provider_strategy_get', LiquidityManagerLogger)
  getStrategy() {
    return 'Relay' as const
  }

  @LogOperation('provider_quote_generation', LiquidityManagerLogger)
  async getQuote(
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
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
        throw EcoError.RebalancingRouteNotFound()
      }

      const slippage = 1 - Number(amountOut) / Number(amountIn)

      // Business event: Log successful quote generation
      this.logger.logProviderQuoteGeneration(
        'Relay',
        {
          sourceChainId: tokenIn.chainId,
          destinationChainId: tokenOut.chainId,
          amount: swapAmount,
          tokenIn: tokenIn.config.address,
          tokenOut: tokenOut.config.address,
          slippage,
        },
        true,
      )

      return {
        slippage,
        tokenIn,
        tokenOut,
        amountIn: BigInt(amountIn),
        amountOut: BigInt(amountOut),
        strategy: await this.getStrategy(),
        context: relayQuote,
      }
    } catch (error) {
      // Business event: Log quote generation failure
      this.logger.logProviderQuoteGeneration(
        'Relay',
        {
          sourceChainId: tokenIn.chainId,
          destinationChainId: tokenOut.chainId,
          amount: swapAmount,
          tokenIn: tokenIn.config.address,
          tokenOut: tokenOut.config.address,
        },
        false,
      )
      throw error
    }
  }

  @LogOperation('provider_execution', LiquidityManagerLogger)
  async execute(
    @LogContext walletAddress: string,
    @LogContext quote: RebalanceQuote<'Relay'>,
  ): Promise<unknown> {
    try {
      const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

      // Verify the wallet matches the configured one
      if (client.account!.address !== walletAddress) {
        throw new Error('Wallet address mismatch for Relay execution')
      }

      // Business event: Log provider execution
      this.logger.logProviderExecution('Relay', walletAddress, quote)

      // Adapt the kernel wallet to a Relay-compatible wallet
      const adaptedWallet = adaptKernelWallet(client, (chainId) =>
        this.kernelAccountClientService.getClient(chainId),
      )

      // Execute the quote
      const res = await getClient()?.actions.execute({
        quote: quote.context,
        wallet: adaptedWallet,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        onProgress: (data) => {
          // Progress logging is handled by decorators
        },
      })

      await this.rebalanceRepository.updateStatus(quote.rebalanceJobID!, RebalanceStatus.COMPLETED)
      return res
    } catch (error) {
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
