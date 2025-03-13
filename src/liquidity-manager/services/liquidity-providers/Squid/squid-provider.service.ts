import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import { erc20Abi, Hex, parseUnits } from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { SquidConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { Squid } from '@0xsquid/sdk'
import { ethers } from 'ethers'
import { KernelAccountClientV2Service } from '@/transaction/smart-wallets/kernel/kernel-account-client-v2.service'
import { toEthersSigner } from '@/common/viem/ethersAdapter'

@Injectable()
export class SquidProviderService implements IRebalanceProvider<'Squid'> {
  private logger = new Logger(SquidProviderService.name)

  private config: SquidConfig
  private liquidityManagerQueue: LiquidityManagerQueue

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientV2Service,
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.config = this.ecoConfigService.getSquid()
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
  }

  getStrategy() {
    return 'Squid' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote<'Squid'>> {
    const amountIn = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)
    const amountOut = parseUnits(swapAmount.toString(), tokenOut.balance.decimals)

    return {
      amountIn: amountIn,
      amountOut: amountOut,
      slippage: 0,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      strategy: this.getStrategy(),
      context: undefined,
    }
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'Squid'>) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'SquidProviderService: executing quote',
        properties: {
          tokenIn: quote.tokenIn.config.address,
          chainIn: quote.tokenIn.config.chainId,
          tokenOut: quote.tokenOut.config.address,
          chainOut: quote.tokenOut.config.chainId,
          amountIn: quote.amountIn,
          amountOut: quote.amountOut,
          slippage: quote.slippage,
        },
      }),
    )

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.config.chainId)

    const squid = new Squid({
      baseUrl: 'https://apiplus.squidrouter.com',
      integratorId: this.config.integratorId,
    })
    await squid.init()

    const recipient = await this.kernelAccountClientService.getAddress()

    // Set up parameters for swapping tokens
    const params = {
      fromAddress: recipient,
      fromChain: quote.tokenIn.config.chainId,
      fromToken: quote.tokenIn.config.address,
      fromAmount: quote.amountIn,
      toChain: quote.tokenOut.config.chainId,
      toToken: quote.tokenOut.config.address,
      toAddress: recipient,
      enableBoost: true,
    }

    // Get the swap route using Squid SDK
    const { route, requestId } = await squid.getRoute(params)

    const transactionRequest = route.transactionRequest

    const approveTxHash = await client.writeContract({
      abi: erc20Abi,
      functionName: 'approve',
      address: quote.tokenIn.config.address,
      args: [transactionRequest.target, quote.amountIn],
    })

    await client.waitForUserOperationReceipt({ hash: approveTxHash })

    const signer = toEthersSigner(client)

    // Execute the swap transaction
    const tx: ethers.TransactionResponse = await squid.executeRoute({
      signer,
      route,
    })

    await client.waitForUserOperationReceipt({ hash: tx.hash as Hex })

    // Show the transaction receipt with Axelarscan link
    const axelarScanLink = 'https://axelarscan.io/gmp/' + tx.hash
    this.logger.log(`Finished! Check Axelarscan for details: ${axelarScanLink}`)

    // Wait a few seconds before checking the status
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Parameters for checking the status of the transaction
    const getStatusParams = {
      transactionId: tx.hash,
      requestId: requestId,
      integratorId: this.config.integratorId,
      fromChainId: quote.tokenIn.config.chainId,
      toChainId: quote.tokenOut.config.chainId,
    }

    const completedStatuses = ['success', 'partial_success', 'needs_gas', 'not_found']
    const maxRetries = 10 // Maximum number of retries for status check
    let retryCount = 0
    let status = await squid.getStatus(getStatusParams)

    // Loop to check the transaction status until it is completed or max retries are reached
    this.logger.log(`Initial route status: ${status.squidTransactionStatus}`)

    do {
      try {
        // Wait a few seconds before checking the status
        await new Promise((resolve) => setTimeout(resolve, 5000))

        // Retrieve the transaction's route status
        status = await squid.getStatus(getStatusParams)

        // Display the route status
        this.logger.log(`Route status: ${status.squidTransactionStatus}`)
      } catch (error: unknown) {
        // Handle error if the transaction status is not found
        if (
          error instanceof Error &&
          (error as any).response &&
          (error as any).response.status === 404
        ) {
          retryCount++
          if (retryCount >= maxRetries) {
            this.logger.error('Max retries reached. Transaction not found.')
            break
          }
          this.logger.log('Transaction not found. Retrying...')
          continue
        } else {
          throw error
        }
      }
    } while (status && !completedStatuses.includes(status.squidTransactionStatus!))

    // Wait for the transaction to be mined
    this.logger.log('Swap transaction executed:', tx.hash)
  }
}
