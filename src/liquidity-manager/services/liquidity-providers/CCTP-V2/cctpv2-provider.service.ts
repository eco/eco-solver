import { isAddressEqual, parseUnits, Hex, encodeFunctionData, pad, erc20Abi } from 'viem'
import { Injectable, Logger } from '@nestjs/common'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { CCTPV2StrategyContext, RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { InjectQueue } from '@nestjs/bullmq'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CheckCCTPV2AttestationJobData } from '@/liquidity-manager/jobs/check-cctpv2-attestation.job'
import { CCTPV2Config } from '@/eco-configs/eco-config.types'
import { CCTPV2TokenMessengerABI } from '@/contracts/CCTPV2TokenMessenger'
import { CCTPV2MessageTransmitterABI } from '@/contracts/CCTPV2MessageTransmitter'
import { serialize } from '@/common/utils/serialize'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'
import { LmTxGatedWalletClientService } from '../../../wallet-wrappers/wallet-gated-client.service'

const CCTPV2_FINALITY_THRESHOLD_FAST = 1000
const CCTPV2_FINALITY_THRESHOLD_STANDARD = 2000

@Injectable()
export class CCTPV2ProviderService implements IRebalanceProvider<'CCTPV2'> {
  private logger = new Logger(CCTPV2ProviderService.name)
  private liquidityManagerQueue: LiquidityManagerQueue
  private config: CCTPV2Config

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: LmTxGatedKernelAccountClientService,
    private readonly walletClientService: LmTxGatedWalletClientService,
    private readonly rebalanceRepository: RebalanceRepository,
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
    this.config = this.ecoConfigService.getCCTPV2()
  }

  getStrategy() {
    return 'CCTPV2' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'CCTPV2'>[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPV2: Getting quote',
        id,
        properties: {
          tokenIn: { chainId: tokenIn.chainId, address: tokenIn.config.address },
          tokenOut: { chainId: tokenOut.chainId, address: tokenOut.config.address },
          swapAmount,
        },
      }),
    )

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
          this.logger.debug(
            EcoLogMessage.withId({
              message: 'CCTPV2: Fast transfer quote created',
              id,
              properties: { quote },
            }),
          )
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
        this.logger.debug(
          EcoLogMessage.withId({
            message: 'CCTPV2: Standard transfer quote created',
            id,
            properties: { quote },
          }),
        )
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

    this.logger.warn(
      EcoLogMessage.withId({
        message: 'CCTPV2: No fee options found, returning default standard quote',
        id,
        properties: { defaultQuote },
      }),
    )
    return [defaultQuote]
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'CCTPV2'>): Promise<unknown> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPV2: Executing quote',
        id: quote.id,
        properties: { quote, walletAddress },
      }),
    )
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

  async fetchV2Attestation(
    transactionHash: Hex,
    sourceDomain: number,
    quoteId?: string,
  ): Promise<{ status: 'pending' } | { status: 'complete'; messageBody: Hex; attestation: Hex }> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `CCTPV2: Fetching attestation for domain ${sourceDomain}`,
        id: quoteId,
        properties: {
          transactionHash,
          sourceDomain,
        },
      }),
    )
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
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          message: `Failed to fetch CCTP V2 attestation for tx ${transactionHash} on domain ${sourceDomain}`,
          id: quoteId,
        }),
      )
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
  async receiveV2Message(
    destinationChainId: number,
    messageBody: Hex,
    attestation: Hex,
    quoteId?: string,
  ): Promise<Hex> {
    const v2ChainConfig = this.getV2ChainConfig(destinationChainId)
    const walletClient = await this.walletClientService.getClient(destinationChainId)

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPV2: receiveV2Message: submitting',
        id: quoteId,
        properties: {
          chainId: destinationChainId,
          messageTransmitter: v2ChainConfig.messageTransmitter,
          sender: (walletClient as any).account?.address,
          attestation,
          messageBody,
        },
      }),
    )

    const txHash = await walletClient.writeContract({
      abi: CCTPV2MessageTransmitterABI,
      address: v2ChainConfig.messageTransmitter,
      functionName: 'receiveMessage',
      args: [messageBody, attestation],
    })
    return txHash
  }

  async getTxReceipt(chainId: number, txHash: Hex) {
    const publicClient = await this.walletClientService.getPublicClient(chainId)
    return publicClient.waitForTransactionReceipt({ hash: txHash })
  }

  private async fetchV2FeeOptions(
    sourceDomain: number,
    destinationDomain: number,
    quoteId?: string,
  ): Promise<{ finalityThreshold: number; minimumFee: number }[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `CCTPV2: Fetching fee options for route ${sourceDomain}->${destinationDomain}`,
        id: quoteId,
      }),
    )
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
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          error,
          message: `Failed to fetch CCTP V2 fast transfer fee for route ${sourceDomain}->${destinationDomain}`,
          id: quoteId,
        }),
      )
      // Fallback to an empty array if the API call fails
      return []
    }
  }

  private getV2ChainConfig(chainId: number) {
    const config = this.config.chains.find((chain) => chain.chainId === chainId)
    if (!config) throw new Error(`CCTP V2 config not found for chain ${chainId}`)
    return config
  }

  private isSupportedToken(chainId: number, token: Hex): boolean {
    const isSupported = this.config.chains.some(
      (chain) => chain.chainId === chainId && isAddressEqual(token, chain.token),
    )
    this.logger.debug(`isSupported: ${isSupported}`)
    return isSupported
  }
}
