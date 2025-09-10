import { isAddressEqual, parseUnits, Hex, encodeFunctionData, pad, erc20Abi } from 'viem'
import { Injectable } from '@nestjs/common'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { CCTPV2StrategyContext, RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { InjectQueue } from '@nestjs/bullmq'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
  LIQUIDITY_MANAGER_QUEUE_NAME,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CheckCCTPV2AttestationJobData } from '@/liquidity-manager/jobs/check-cctpv2-attestation.job'
import { CCTPV2Config } from '@/eco-configs/eco-config.types'
import { CCTPV2TokenMessengerABI } from '@/contracts/CCTPV2TokenMessenger'
import { CCTPV2MessageTransmitterABI } from '@/contracts/CCTPV2MessageTransmitter'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { serialize } from '@/common/utils/serialize'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

const CCTPV2_FINALITY_THRESHOLD_FAST = 1000
const CCTPV2_FINALITY_THRESHOLD_STANDARD = 2000

@Injectable()
export class CCTPV2ProviderService implements IRebalanceProvider<'CCTPV2'> {
  private logger = new LiquidityManagerLogger('CCTPv2ProviderService')
  private liquidityManagerQueue: LiquidityManagerQueue
  private config: CCTPV2Config

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly walletClientService: WalletClientDefaultSignerService,
    private readonly rebalanceRepository: RebalanceRepository,
    @InjectQueue(LIQUIDITY_MANAGER_QUEUE_NAME)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
    this.config = this.ecoConfigService.getCCTPV2()
  }

  getStrategy() {
    return 'CCTPV2' as const
  }

  @LogOperation('provider_quote_generation', LiquidityManagerLogger)
  async getQuote(
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    @LogContext swapAmount: number,
    @LogContext id?: string,
  ): Promise<RebalanceQuote<'CCTPV2'>[]> {
    // Quote generation attempt will be logged by decorator

    if (
      !this.isSupportedToken(tokenIn.config.chainId, tokenIn.config.address) ||
      !this.isSupportedToken(tokenOut.config.chainId, tokenOut.config.address)
    ) {
      throw new Error('Unsupported route for CCTP V2')
    }

    const amountIn = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)

    // Fetch fee options from the API
    const sourceDomain = this.getV2ChainConfig(tokenIn.chainId).domain
    const destinationDomain = this.getV2ChainConfig(tokenOut.chainId).domain
    const feeOptions = await this.fetchV2FeeOptions(sourceDomain, destinationDomain, id)

    const createQuote = (
      option: { finalityThreshold: number; minimumFee: number },
      transferType: 'fast' | 'standard',
    ): RebalanceQuote<'CCTPV2'> | null => {
      const feeBps = option.minimumFee
      const fee = (amountIn * BigInt(feeBps)) / 10000n
      const amountOutAfterFee = amountIn - fee

      if (amountOutAfterFee <= 0) return null

      const context: CCTPV2StrategyContext = {
        transferType,
        fee,
        feeBps,
        minFinalityThreshold: option.finalityThreshold,
      }
      return {
        amountIn,
        amountOut: amountOutAfterFee,
        slippage: Number((feeBps / 100).toFixed(4)), // Convert bps to percentage (1 bps = 0.01%) and round to 4 decimal places
        tokenIn,
        tokenOut,
        strategy: this.getStrategy(),
        context,
        id,
      }
    }

    // Prioritize fast transfer if enabled and available
    if (this.config.fastTransferEnabled) {
      const fastOption = feeOptions.find(
        (o) => o.finalityThreshold === CCTPV2_FINALITY_THRESHOLD_FAST,
      )
      if (fastOption) {
        const quote = createQuote(fastOption, 'fast')
        if (quote) {
          // Quote generation success will be logged by decorator
          return [quote]
        }
      }
    }

    // Fallback to standard transfer
    const standardOption = feeOptions.find(
      (o) => o.finalityThreshold === CCTPV2_FINALITY_THRESHOLD_STANDARD,
    )
    if (standardOption) {
      const quote = createQuote(standardOption, 'standard')
      if (quote) {
        // Quote generation success will be logged by decorator
        return [quote]
      }
    }

    // If API failed or no suitable options, return a default standard quote.
    const defaultQuote: RebalanceQuote<'CCTPV2'> = {
      amountIn,
      amountOut: amountIn, // No fee
      slippage: 0,
      tokenIn,
      tokenOut,
      strategy: this.getStrategy(),
      context: {
        transferType: 'standard',
        fee: 0n,
        feeBps: 0,
        minFinalityThreshold: CCTPV2_FINALITY_THRESHOLD_STANDARD,
      },
      id,
    }

    // Using fallback quote - will be logged as business event below
    this.logger.logProviderQuoteGeneration(
      'CCTPv2',
      {
        sourceChainId: tokenIn.chainId,
        destinationChainId: tokenOut.chainId,
        amount: swapAmount,
        tokenIn: tokenIn.config.address,
        tokenOut: tokenOut.config.address,
      },
      true,
    )
    return [defaultQuote]
  }

  @LogOperation('provider_execution', LiquidityManagerLogger)
  async execute(
    @LogContext walletAddress: string,
    @LogContext quote: RebalanceQuote<'CCTPV2'>,
  ): Promise<unknown> {
    // Execution start will be logged by decorator
    this.logger.logProviderExecution('CCTPv2', walletAddress, quote)
    try {
      const txHash = await this._execute(walletAddress, quote)

      const sourceDomain = this.getV2ChainConfig(quote.tokenIn.chainId).domain

      const checkCCTPV2AttestationJobData: CheckCCTPV2AttestationJobData = {
        groupID: quote.groupID!,
        rebalanceJobID: quote.rebalanceJobID!,
        destinationChainId: quote.tokenOut.chainId,
        transactionHash: txHash,
        sourceDomain: sourceDomain,
        context: serialize(quote.context),
        id: quote.id,
      }

      await this.liquidityManagerQueue.startCCTPV2AttestationCheck(checkCCTPV2AttestationJobData)

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

  private async _execute(walletAddress: string, quote: RebalanceQuote<'CCTPV2'>): Promise<Hex> {
    const sourceChainConfig = this.getV2ChainConfig(quote.tokenIn.chainId)
    const destinationChainConfig = this.getV2ChainConfig(quote.tokenOut.chainId)
    const amount = quote.amountIn // Burn the full amount, fee is deducted on destination

    const { minFinalityThreshold } = quote.context

    const depositForBurnData = encodeFunctionData({
      abi: CCTPV2TokenMessengerABI as any,
      functionName: 'depositForBurn',
      args: [
        amount,
        destinationChainConfig.domain,
        pad(walletAddress as Hex),
        sourceChainConfig.token,
        pad('0x0'), // destinationCaller
        quote.context.fee, // maxFee
        minFinalityThreshold, // minFinalityThreshold
      ],
    })

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

    // Create the approval transaction
    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [sourceChainConfig.tokenMessenger, amount],
    })

    const approveTx = {
      to: sourceChainConfig.token, // The token we are approving
      data: approveData,
    }

    // Create the burn transaction
    const burnTx = {
      to: sourceChainConfig.tokenMessenger,
      data: depositForBurnData,
    }

    return client.execute([approveTx, burnTx])
  }

  @LogOperation('provider_validation', LiquidityManagerLogger)
  async fetchV2Attestation(
    @LogContext transactionHash: Hex,
    @LogContext sourceDomain: number,
    @LogContext _quoteId?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<{ status: 'pending' } | { status: 'complete'; messageBody: Hex; attestation: Hex }> {
    // Attestation fetch start will be logged by decorator
    try {
      const url = new URL(`${this.config.apiUrl}/v2/messages/${sourceDomain}`)
      url.searchParams.append('transactionHash', transactionHash)

      const response = await fetch(url.toString())

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`)
      }

      const data = await response.json()

      if (data?.messages && data.messages.length > 0) {
        const message = data.messages[0]
        // The API may return a message object with an attestation string of "PENDING"
        if (
          message.attestation &&
          message.attestation !== 'PENDING' &&
          message.status === 'complete'
        ) {
          return {
            status: 'complete',
            messageBody: message.message,
            attestation: message.attestation,
          }
        }
      }

      return { status: 'pending' }
    } catch (error) {
      // Error logging will be handled by decorator
      // If there's an error, we assume it's still pending so the job can be retried.
      return { status: 'pending' }
    }
  }

  /**
   * Receive message from CCTP V2. It does not wait for the transaction receipt.
   * @param destinationChainId Destination chain ID
   * @param messageBody Message body
   * @param attestation Attestation
   * @param quoteId Quote ID
   * @returns Transaction hash
   */
  @LogOperation('provider_execution', LiquidityManagerLogger)
  async receiveV2Message(
    @LogContext destinationChainId: number,
    @LogContext messageBody: Hex,
    @LogContext attestation: Hex,
    @LogContext _quoteId?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Hex> {
    const v2ChainConfig = this.getV2ChainConfig(destinationChainId)
    const walletClient = await this.walletClientService.getClient(destinationChainId)

    // Message receipt execution will be logged by decorator

    const txHash = await walletClient.writeContract({
      abi: CCTPV2MessageTransmitterABI,
      address: v2ChainConfig.messageTransmitter,
      functionName: 'receiveMessage',
      args: [messageBody, attestation],
    })
    return txHash
  }

  @LogOperation('provider_validation', LiquidityManagerLogger)
  async getTxReceipt(@LogContext chainId: number, @LogContext txHash: Hex) {
    const publicClient = await this.walletClientService.getPublicClient(chainId)
    return publicClient.waitForTransactionReceipt({ hash: txHash })
  }

  private async fetchV2FeeOptions(
    sourceDomain: number,
    destinationDomain: number,
    _quoteId?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<{ finalityThreshold: number; minimumFee: number }[]> {
    // Fee options fetch will be logged by sub-operation if needed
    try {
      // Endpoint uses path parameters
      const url = `${this.config.apiUrl}/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}`

      const response = await fetch(url)

      if (!response.ok) {
        // Log the error response if possible
        const errorBody = await response.text()
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`)
      }

      const feeData = await response.json()
      // API returns an array of fee options
      return feeData || []
    } catch (error) {
      // Error will be logged by calling method decorator or handled separately if needed
      // Fallback to an empty array if the API call fails
      return []
    }
  }

  private getV2ChainConfig(chainId: number) {
    const config = this.config.chains.find((chain) => chain.chainId === chainId)
    if (!config) throw new Error(`CCTP V2 config not found for chain ${chainId}`)
    return config
  }

  @LogOperation('provider_validation', LiquidityManagerLogger)
  private isSupportedToken(@LogContext chainId: number, @LogContext token: Hex): boolean {
    const isSupported = this.config.chains.some(
      (chain) => chain.chainId === chainId && isAddressEqual(token, chain.token),
    )
    // Domain validation result will be logged as business event
    this.logger.logProviderDomainValidation('CCTPv2', chainId.toString(), isSupported)
    return isSupported
  }
}
