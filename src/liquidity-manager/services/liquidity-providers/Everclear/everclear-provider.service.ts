import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
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
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EverclearApiError } from './everclear.errors'
import { getSlippage } from '@/liquidity-manager/utils/math'
import { createApproveTransaction } from '@/liquidity-manager/utils/transaction'

@Injectable()
export class EverclearProviderService implements IRebalanceProvider<'Everclear'>, OnModuleInit {
  private logger = new Logger(EverclearProviderService.name)
  private config: EverclearConfig
  private readonly liquidityManagerQueue: LiquidityManagerQueue

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(this.queue)
  }

  async onModuleInit() {
    this.config = this.ecoConfigService.getEverclear()
  }

  getStrategy() {
    return 'Everclear' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'Everclear'>[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Everclear: getting quote',
        id,
        properties: { tokenIn, tokenOut, swapAmount },
      }),
    )

    const walletAddress = await this.kernelAccountClientService.getAddress()
    const amount = parseUnits(swapAmount.toString(), tokenIn.balance.decimals).toString()

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
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          message: errorMessage,
          error: new Error(errorBody),
          id,
          properties: { requestBody },
        }),
      )
      throw new EverclearApiError(errorMessage, response.status, errorBody, {
        requestBody,
      })
    }

    const everclearQuote = await response.json()

    const slippage = getSlippage(everclearQuote.expectedAmount, amount)

    const quote: RebalanceQuote<'Everclear'> = {
      amountIn: BigInt(amount),
      amountOut: BigInt(everclearQuote.expectedAmount),
      slippage,
      tokenIn,
      tokenOut,
      strategy: this.getStrategy(),
      context: undefined, // No context needed for execution from this quote
      id,
    }

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Everclear: quote generated',
        id,
        properties: { quote },
      }),
    )

    return [quote]
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'Everclear'>): Promise<string> {
    const { tokenIn, tokenOut, amountIn, id } = quote

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Everclear: executing quote',
        id,
        properties: { walletAddress, quote },
      }),
    )

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
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          message: errorMessage,
          error: new Error(errorBody),
          id,
          properties: { requestBody },
        }),
      )
      throw new EverclearApiError(errorMessage, response.status, errorBody, {
        requestBody,
      })
    }

    const txRequest = await response.json()
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Everclear: intent created',
        id,
        properties: { txRequest },
      }),
    )

    const client = await this.kernelAccountClientService.getClient(tokenIn.chainId)

    if (!client.account || !client.chain) {
      throw new Error('Kernel client account or chain is not available.')
    }

    const spenderAddress = txRequest.to as Hex
    const approveTx = createApproveTransaction(tokenIn.config.address, spenderAddress, amountIn)
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Everclear: approving tokens',
        id,
        properties: { approveTx },
      }),
    )

    const intentTx = {
      to: txRequest.to,
      data: txRequest.data,
      value: BigInt(txRequest.value ?? 0),
    }
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Everclear: intent transaction',
        id,
        properties: { intentTx },
      }),
    )

    let txHash: Hex
    try {
      txHash = await client.execute([approveTx, intentTx])
      const txReceipt = await client.waitForTransactionReceipt({ hash: txHash })
      if (!txReceipt) {
        throw new Error('Transaction receipt was null.')
      }

      this.logger.log(
        EcoLogMessage.withId({
          message: 'Everclear: transaction sent',
          id,
          properties: { txHash, txReceipt },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          message: 'Everclear: transaction failed',
          error,
          id,
          properties: { txRequest },
        }),
      )
      throw error
    }

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'Everclear: transaction sent',
        id,
        properties: { txHash },
      }),
    )

    await this.liquidityManagerQueue.startCheckEverclearIntent({
      txHash,
      id: quote.id,
    })

    this.logger.log(
      EcoLogMessage.withId({
        message: 'Everclear: intent monitoring job queued',
        id,
        properties: { txHash },
      }),
    )

    return txHash
  }

  async checkIntentStatus(
    txHash: Hex,
  ): Promise<{ status: 'pending' | 'complete' | 'failed'; intentId?: string }> {
    // 1. Get intent by txHash
    const intentResponse = await fetch(`${this.config.baseUrl}/intents?txHash=${txHash}`)
    if (!intentResponse.ok) {
      this.logger.error(`Failed to fetch intent by txHash ${txHash}`)
      return { status: 'pending' } // Could be a temporary API issue, so keep polling
    }

    const response = await intentResponse.json()

    // Check if response has intents array
    if (!response.intents || response.intents.length === 0) {
      this.logger.debug(`Intent for txHash ${txHash} not found yet.`)
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
