import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Squid } from '@0xsquid/sdk'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { parseUnits } from 'viem'
import { walletClientToSigner } from '@/common/utils/viem-to-ethers'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoError } from '@/common/errors/eco-error'

@Injectable()
export class SquidProviderService implements OnModuleInit, IRebalanceProvider<'Squid'> {
  private logger = new Logger(SquidProviderService.name)
  private squid: Squid

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {}

  async onModuleInit() {
    const squidConfig = this.ecoConfigService.getSquid()
    this.squid = new Squid({
      baseUrl: squidConfig.baseUrl,
      integratorId: squidConfig.integratorId,
    })
    await this.squid.init()
  }

  getStrategy() {
    return 'Squid' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'Squid'>[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Squid: getting quote',
        id,
        properties: { tokenIn, tokenOut, swapAmount },
      }),
    )

    const walletAddress = await this.kernelAccountClientService.getAddress()
    const { swapSlippage } = this.ecoConfigService.getLiquidityManager()

    const params = {
      fromChain: tokenIn.chainId.toString(),
      fromToken: tokenIn.config.address,
      fromAmount: parseUnits(swapAmount.toString(), tokenIn.balance.decimals).toString(),
      toChain: tokenOut.chainId.toString(),
      toToken: tokenOut.config.address,
      toAddress: walletAddress,
      slippage: swapSlippage,
      quoteOnly: false,
    }

    try {
      const { route } = await this.squid.getRoute(params)

      // The fromAmount is an exact amount, so slippage is on the fromAmount
      const toAmountMin = BigInt(route.estimate.toAmountMin)
      const fromAmount = BigInt(route.estimate.fromAmount)
      const slippage = Number(fromAmount - toAmountMin) / Number(fromAmount)

      const quote: RebalanceQuote<'Squid'> = {
        amountIn: BigInt(route.estimate.fromAmount),
        amountOut: BigInt(route.estimate.toAmount),
        slippage,
        tokenIn,
        tokenOut,
        strategy: this.getStrategy(),
        context: route,
        id,
      }

      this.logger.debug(
        EcoLogMessage.withId({
          message: 'Squid: quote generated',
          id,
          properties: { quote },
        }),
      )

      return [quote]
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          message: 'Squid: failed to get quote',
          id,
          error,
          properties: { params },
        }),
      )
      throw error
    }
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'Squid'>): Promise<unknown> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Squid: executing quote',
        id: quote.id,
        properties: { walletAddress, quote },
      }),
    )

    try {
      const kernelAddress = await this.kernelAccountClientService.getAddress()
      if (walletAddress !== kernelAddress) {
        throw EcoError.InvalidKernelAccountConfig()
      }

      const { context: route } = quote
      const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)
      const signer = walletClientToSigner(client)

      const txResponse = await this.squid.executeRoute({
        signer: signer as any,
        route,
      })

      if (!('wait' in txResponse)) {
        throw new Error('Squid SDK returned an unexpected transaction response type.')
      }

      const txReceipt = await txResponse.wait()

      if (!txReceipt) {
        throw new Error('Transaction receipt was null.')
      }

      this.logger.log(
        EcoLogMessage.withId({
          message: 'Squid: execution complete',
          id: quote.id,
          properties: { receipt: txReceipt },
        }),
      )

      return (txReceipt as any).transactionHash
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          message: `Squid: failed to execute quote`,
          id: quote.id,
          error,
          properties: { walletAddress, quote },
        }),
      )
      throw error
    }
  }
}
