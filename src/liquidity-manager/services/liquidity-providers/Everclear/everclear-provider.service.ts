import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { InjectQueue } from '@nestjs/bullmq'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { EverclearConfig } from '@/eco-configs/eco-config.types'
import { parseUnits } from 'viem'
import { Hex } from 'viem'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EverclearApiError } from './everclear.errors'
import { getSlippage } from '@/liquidity-manager/utils/math'
import { createApproveTransaction } from '@/liquidity-manager/utils/transaction'
import { Cacheable } from '@/decorators/cacheable.decorator'
import { erc20Abi } from 'viem'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

@Injectable()
export class EverclearProviderService implements IRebalanceProvider<'Everclear'>, OnModuleInit {
  private logger = new LiquidityManagerLogger('EverclearProviderService')
  private config: EverclearConfig
  private readonly liquidityManagerQueue: LiquidityManagerQueue

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly rebalanceRepository: RebalanceRepository,
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(this.queue)
  }

  @LogOperation('provider_bootstrap', LiquidityManagerLogger)
  async onModuleInit() {
    this.config = this.configService.getEverclear()

    // Log provider bootstrap completion
    this.logger.logProviderBootstrap('Everclear', 0, true) // Chain ID 0 represents multi-chain support
  }

  getStrategy() {
    return 'Everclear' as const
  }

  @Cacheable({ ttl: 60 * 60 * 24 * 30 * 1000 }) // 30 days
  private async getTokenSymbol(chainId: number, address: Hex): Promise<string> {
    const client = await this.kernelAccountClientService.getClient(chainId)
    return client.readContract({
      abi: erc20Abi,
      address,
      functionName: 'symbol',
    })
  }

  @LogOperation('provider_quote_generation', LiquidityManagerLogger)
  async getQuote(
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
    @LogContext id?: string,
  ): Promise<RebalanceQuote<'Everclear'>[]> {
    // Everclear only supports cross-chain transfers of the same token representation.
    // If origin and destination chains are the same, skip quoting entirely.
    if (tokenIn.chainId === tokenOut.chainId) {
      this.logger.logProviderDomainValidation('Everclear', tokenIn.chainId.toString(), false)
      return []
    }

    const [tokenInSymbol, tokenOutSymbol] = await Promise.all([
      this.getTokenSymbol(tokenIn.config.chainId, tokenIn.config.address),
      this.getTokenSymbol(tokenOut.config.chainId, tokenOut.config.address),
    ])

    if (tokenInSymbol !== tokenOutSymbol) {
      this.logger.logProviderQuoteGeneration(
        'Everclear',
        {
          tokenIn,
          tokenOut,
          sourceChainId: tokenIn.chainId,
          destinationChainId: tokenOut.chainId,
          amount: swapAmount,
        },
        false,
      )
      return []
    }

    const walletAddress = await this.kernelAccountClientService.getAddress()
    const amountParsed = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)
    if (amountParsed <= 0n) {
      this.logger.warn(
        EcoLogMessage.withId({
          message: 'Everclear: parsed amountIn is zero, skipping quote',
          id,
          properties: { swapAmount, decimals: tokenIn.balance.decimals },
        }),
      )
      return []
    }
    const amount = amountParsed.toString()

    const requestBody = {
      origin: tokenIn.chainId.toString(),
      destinations: [tokenOut.chainId.toString()],
      inputAsset: tokenIn.config.address,
      amount,
      to: walletAddress,
    }

    const response = await fetch(`${this.config.baseUrl}/routes/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      const errorMessage = `Everclear API error: ${response.status} ${response.statusText}`
      throw new EverclearApiError(errorMessage, response.status, errorBody, {
        requestBody,
      })
    }

    const everclearQuote = await response.json()

    const expectedAmount = BigInt(everclearQuote.expectedAmount)
    if (expectedAmount <= 0n) {
      this.logger.warn(
        EcoLogMessage.withId({
          message: 'Everclear: expectedAmount <= 0, skipping quote',
          id,
          properties: { expectedAmount: everclearQuote.expectedAmount, amount },
        }),
      )
      return []
    }

    const slippage = getSlippage(everclearQuote.expectedAmount, amount)

    const quote: RebalanceQuote<'Everclear'> = {
      amountIn: BigInt(amount),
      amountOut: expectedAmount,
      slippage,
      tokenIn,
      tokenOut,
      strategy: this.getStrategy(),
      context: undefined, // No context needed for execution from this quote
      id,
    }

    // Log successful quote generation
    this.logger.logProviderQuoteGeneration(
      'Everclear',
      {
        tokenIn,
        tokenOut,
        sourceChainId: tokenIn.chainId,
        destinationChainId: tokenOut.chainId,
        amount: swapAmount,
        slippage,
      },
      true,
    )

    return [quote]
  }

  @LogOperation('provider_execution', LiquidityManagerLogger)
  async execute(
    @LogContext walletAddress: string,
    @LogContext quote: RebalanceQuote<'Everclear'>,
  ): Promise<string> {
    try {
      const { tokenIn, tokenOut, amountIn } = quote

      // Log execution start
      this.logger.logProviderExecution('Everclear', walletAddress, quote)

      // Everclear only supports cross-chain transfers of the same token representation.
      // If origin and destination chains are the same, do not execute.
      if (tokenIn.chainId === tokenOut.chainId) {
        this.logger.logProviderDomainValidation('Everclear', tokenIn.chainId.toString(), false)
        throw new Error(
          `Everclear: same-chain swaps are not supported ${tokenIn.chainId} -> ${tokenOut.chainId}`,
        )
      }

      const [tokenInSymbol, tokenOutSymbol] = await Promise.all([
        this.getTokenSymbol(tokenIn.config.chainId, tokenIn.config.address),
        this.getTokenSymbol(tokenOut.config.chainId, tokenOut.config.address),
      ])

      if (tokenInSymbol !== tokenOutSymbol) {
        this.logger.logProviderQuoteGeneration(
          'Everclear',
          {
            tokenIn,
            tokenOut,
            sourceChainId: tokenIn.chainId,
            destinationChainId: tokenOut.chainId,
            amount: Number(amountIn),
          },
          false,
        )
        throw new Error(
          `Everclear: cross-token swaps are not supported ${tokenInSymbol} -> ${tokenOutSymbol}`,
        )
      }

      const requestBody = {
        origin: tokenIn.chainId.toString(),
        destinations: [tokenOut.chainId.toString()],
        inputAsset: tokenIn.config.address,
        amount: amountIn.toString(),
        to: walletAddress,
        maxFee: '0',
        callData: '0x',
      }

      const response = await fetch(`${this.config.baseUrl}/intents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        const errorMessage = `Everclear API error on /intents: ${response.status} ${response.statusText}`
        throw new EverclearApiError(errorMessage, response.status, errorBody, {
          requestBody,
        })
      }

      const txRequest = await response.json()
      const client = await this.kernelAccountClientService.getClient(tokenIn.chainId)

      if (!client.account || !client.chain) {
        throw new Error('Kernel client account or chain is not available.')
      }

      const spenderAddress = txRequest.to as Hex
      const approveTx = createApproveTransaction(tokenIn.config.address, spenderAddress, amountIn)

      const intentTx = {
        to: txRequest.to,
        data: txRequest.data,
        value: BigInt(txRequest.value ?? 0),
      }

      let txHash: Hex
      try {
        txHash = await client.execute([approveTx, intentTx])
        const txReceipt = await client.waitForTransactionReceipt({ hash: txHash })
        if (!txReceipt) {
          throw new Error('Transaction receipt was null.')
        }
      } catch (error) {
        throw error
      }

      await this.liquidityManagerQueue.startCheckEverclearIntent({
        groupID: quote.groupID!,
        rebalanceJobID: quote.rebalanceJobID!,
        txHash,
        id: quote.id,
      })

      return txHash
    } catch (error) {
      try {
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
      } catch {}
      throw error
    }
  }

  @LogOperation('provider_validation', LiquidityManagerLogger)
  async checkIntentStatus(
    @LogContext txHash: Hex,
  ): Promise<{ status: 'pending' | 'complete' | 'failed'; intentId?: string }> {
    // 1. Get intent by txHash
    const intentResponse = await fetch(`${this.config.baseUrl}/intents?txHash=${txHash}`)
    if (!intentResponse.ok) {
      return { status: 'pending' } // Could be a temporary API issue, so keep polling
    }

    const response = await intentResponse.json()

    // Check if response has intents array
    if (!response.intents || response.intents.length === 0) {
      return { status: 'pending' }
    }

    const intent = response.intents[0]
    const intentId = intent.intent_id

    // Check status field for intent state
    switch (intent.status) {
      case 'SETTLED_AND_COMPLETED':
      case 'SETTLED_AND_MANUALLY_EXECUTED':
        return { status: 'complete', intentId }
      case 'UNSUPPORTED':
      case 'UNSUPPORTED_RETURNED':
        return { status: 'failed', intentId }
      case 'NONE':
      case 'ADDED':
      case 'DEPOSIT_PROCESSED':
      case 'FILLED':
      case 'ADDED_AND_FILLED':
      case 'INVOICED':
      case 'SETTLED':
      case 'DISPATCHED':
      default:
        return { status: 'pending', intentId }
    }
  }
}
