import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Squid } from '@0xsquid/sdk'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { encodeFunctionData, erc20Abi } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoError } from '@/common/errors/eco-error'
import { getSlippagePercent } from '@/liquidity-manager/utils/math'
import { convertNormScalar, deconvertNormScalar } from '@/fee/utils'

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
    swapAmountBased: bigint,
    id?: string,
  ): Promise<RebalanceQuote<'Squid'>[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Squid: getting quote',
        id,
        properties: { tokenIn, tokenOut, swapAmountBased },
      }),
    )

    const walletAddress = await this.kernelAccountClientService.getAddress()
    const { swapSlippage } = this.ecoConfigService.getLiquidityManager()

    const params = {
      fromAddress: walletAddress,
      fromChain: tokenIn.chainId.toString(),
      fromToken: tokenIn.config.address,
      // swapAmountBased is already normalized to BASE_DECIMALS, so we need to convert back to original token decimals
      fromAmount: deconvertNormScalar(
        swapAmountBased,
        tokenIn.balance.decimals.original,
      ).toString(),
      toChain: tokenOut.chainId.toString(),
      toToken: tokenOut.config.address,
      toAddress: walletAddress,
      slippage: swapSlippage * 100, // Slippage is in basis points
      quoteOnly: false,
    }

    try {
      const { route } = await this.squid.getRoute(params)

      const dstTokenMin = {
        address: tokenOut.config.address,
        decimals: tokenOut.balance.decimals,
        balance: convertNormScalar(
          BigInt(route.estimate.toAmountMin),
          tokenOut.balance.decimals.original,
        ),
      }
      const srcToken = {
        address: tokenIn.config.address,
        decimals: tokenIn.balance.decimals,
        balance: convertNormScalar(
          BigInt(route.estimate.fromAmount),
          tokenIn.balance.decimals.original,
        ),
      }
      const slippage = getSlippagePercent(dstTokenMin, srcToken)

      const quote: RebalanceQuote<'Squid'> = {
        amountIn: convertNormScalar(
          BigInt(route.estimate.fromAmount),
          tokenIn.balance.decimals.original,
        ),
        amountOut: convertNormScalar(
          BigInt(route.estimate.toAmount),
          tokenOut.balance.decimals.original,
        ),
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

  async execute(walletAddress: string, quote: RebalanceQuote<'Squid'>): Promise<string> {
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
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [route.transactionRequest.target!, BigInt(route.params.fromAmount)],
      })
      const approveTx = {
        to: route.params.fromToken,
        data: approveData,
      }

      // Build the Squid router execution tx
      const swapTx = {
        to: route.transactionRequest.target,
        data: route.transactionRequest.data,
        value: route.transactionRequest.value ? BigInt(route.transactionRequest.value) : undefined,
      }

      const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

      // Execute all in a single userOp to beat the expiry.
      const txHash = await client.execute([approveTx, swapTx])

      const txReceipt = await client.waitForTransactionReceipt({
        hash: txHash,
      })

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

      return txReceipt.transactionHash
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
