import { Injectable } from '@nestjs/common'
import {
  encodeFunctionData,
  erc20Abi,
  Hex,
  isAddressEqual,
  keccak256,
  pad,
  parseEventLogs,
  parseUnits,
  TransactionReceipt,
  TransactionRequest,
} from 'viem'
import { LiquidityManagerLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { CheckCCTPAttestationJobData } from '@/liquidity-manager/jobs/check-cctp-attestation.job'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { CCTPTokenMessengerABI } from '@/contracts/CCTPTokenMessenger'
import { CCTPConfig } from '@/eco-configs/eco-config.types'
import { CCTPMessageTransmitterABI } from '@/contracts/CCTPMessageTransmitter'
import { InjectQueue } from '@nestjs/bullmq'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { LIQUIDITY_MANAGER_QUEUE_NAME } from '@/liquidity-manager/constants/queue.constants'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'
import { LmTxGatedWalletClientService } from '../../../wallet-wrappers/wallet-gated-client.service'

@Injectable()
export class CCTPProviderService implements IRebalanceProvider<'CCTP'> {
  private logger = new LiquidityManagerLogger('CCTPProviderService')

  private config: CCTPConfig
  private liquidityManagerQueue: LiquidityManagerQueue

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: LmTxGatedKernelAccountClientService,
    private readonly walletClientService: LmTxGatedWalletClientService,
    private readonly crowdLiquidityService: CrowdLiquidityService,
    private readonly rebalanceRepository: RebalanceRepository,

    @InjectQueue(LIQUIDITY_MANAGER_QUEUE_NAME)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.config = this.ecoConfigService.getCCTP()
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
  }

  @LogOperation('provider_validation', LiquidityManagerLogger)
  getStrategy() {
    return 'CCTP' as const
  }

  @LogOperation('provider_quote_generation', LiquidityManagerLogger)
  async getQuote(
    @LogContext tokenIn: TokenData,
    @LogContext tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'CCTP'>> {
    const tokenInSupported = this.isSupportedToken(tokenIn.config.chainId, tokenIn.config.address)
    const tokenOutSupported = this.isSupportedToken(
      tokenOut.config.chainId,
      tokenOut.config.address,
    )

    // Log domain validation results
    this.logger.logProviderDomainValidation(
      'CCTP',
      tokenIn.config.chainId.toString(),
      tokenInSupported,
    )
    this.logger.logProviderDomainValidation(
      'CCTP',
      tokenOut.config.chainId.toString(),
      tokenOutSupported,
    )

    if (!tokenInSupported || !tokenOutSupported) {
      throw new Error('Unsupported route')
    }

    const amountIn = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)
    const amountOut = parseUnits(swapAmount.toString(), tokenOut.balance.decimals)

    // Log quote generation success
    this.logger.logProviderQuoteGeneration(
      'CCTP',
      {
        sourceChainId: tokenIn.config.chainId,
        destinationChainId: tokenOut.config.chainId,
        amount: swapAmount,
        tokenIn: tokenIn.config.address,
        tokenOut: tokenOut.config.address,
      },
      true,
    )

    return {
      amountIn: amountIn,
      amountOut: amountOut,
      slippage: 0,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      strategy: this.getStrategy(),
      context: undefined,
      id,
    }
  }

  @LogOperation('provider_execution', LiquidityManagerLogger)
  async execute(@LogContext walletAddress: string, @LogContext quote: RebalanceQuote<'CCTP'>) {
    // Log provider execution start
    this.logger.logProviderExecution('CCTP', walletAddress, quote)

    try {
      const client = await this.kernelAccountClientService.getClient(quote.tokenIn.config.chainId)
      const txHash = await this._execute(walletAddress, quote)
      const txReceipt = await client.waitForTransactionReceipt({ hash: txHash })
      const messageBody = this.getMessageBytes(txReceipt)
      const messageHash = this.getMessageHash(messageBody)

      const checkCCTPAttestationJobData: CheckCCTPAttestationJobData = {
        groupID: quote.groupID!,
        rebalanceJobID: quote.rebalanceJobID!,
        destinationChainId: quote.tokenOut.chainId,
        messageHash,
        messageBody,
        id: quote.id,
      }

      await this.liquidityManagerQueue.startCCTPAttestationCheck(checkCCTPAttestationJobData)
    } catch (error) {
      try {
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
      } catch {}
      throw error
    }
  }

  /**
   * Execute method that returns transaction metadata for CCTPLiFi integration
   * This does not start the CCTP attestation check job
   * @param walletAddress Wallet address
   * @param quote CCTP quote
   * @returns Transaction metadata including hash, messageHash, and messageBody
   */
  @LogOperation('provider_execution', LiquidityManagerLogger)
  async executeWithMetadata(
    @LogContext walletAddress: string,
    @LogContext quote: RebalanceQuote<'CCTP'>,
  ): Promise<{ txHash: Hex; messageHash: Hex; messageBody: Hex }> {
    // Log provider execution start
    this.logger.logProviderExecution('CCTP', walletAddress, quote)

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.config.chainId)
    const txHash = await this._execute(walletAddress, quote)
    const txReceipt = await client.waitForTransactionReceipt({ hash: txHash })
    const messageBody = this.getMessageBytes(txReceipt)
    const messageHash = this.getMessageHash(messageBody)

    return {
      txHash,
      messageHash,
      messageBody,
    }
  }

  private _execute(walletAddress: string, quote: RebalanceQuote<'CCTP'>) {
    const crowdLiquidityPoolWallet = this.crowdLiquidityService.getPoolAddress()
    if (isAddressEqual(crowdLiquidityPoolWallet, walletAddress as Hex)) {
      return this.crowdLiquidityService.rebalanceCCTP(quote.tokenIn, quote.tokenOut)
    }
    return this.executeWithKernel(walletAddress, quote)
  }

  private async executeWithKernel(walletAddress: string, quote: RebalanceQuote<'CCTP'>) {
    const transactions = this.getCCTPTransactions(
      quote.tokenIn,
      quote.tokenOut,
      walletAddress as Hex,
      quote.amountOut,
    )

    const kernelWalletAddress = await this.kernelAccountClientService.getAddress()
    // Make sure the Kernel wallet is used
    if (walletAddress !== kernelWalletAddress) {
      throw new Error('Unexpected wallet during CCTP execution')
    }

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.config.chainId)
    return client.execute(
      transactions.map((tx) => ({ to: tx.to!, data: tx.data ?? '0x', value: tx.value })),
    )
  }

  private getCCTPTransactions(
    tokenIn: TokenData,
    tokenOut: TokenData,
    walletAddress: Hex,
    amount: bigint,
  ): TransactionRequest[] {
    const sourceChain = this.getChainConfig(tokenIn.chainId)
    const destinationChain = this.getChainConfig(tokenOut.chainId)

    // ================== Approve to Message Transmitter ==================

    const approveData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [sourceChain.tokenMessenger, amount],
    })

    const approveTx: TransactionRequest = {
      to: tokenIn.config.address,
      data: approveData,
    }

    // ================== Send tokens with Message Transmitter ==================

    const depositData = encodeFunctionData({
      abi: CCTPTokenMessengerABI,
      functionName: 'depositForBurn',
      args: [amount, destinationChain.domain, pad(walletAddress), tokenIn.config.address],
    })

    const depositTx: TransactionRequest = {
      to: sourceChain.tokenMessenger,
      data: depositData,
    }

    return [approveTx, depositTx]
  }

  private getChainConfig(chainId: number) {
    const config = this.config.chains.find((chain) => chain.chainId === chainId)
    if (!config) throw new Error(`CCTP chain config not found for chain ${chainId}`)
    return config
  }

  async fetchAttestation(
    messageHash: Hex,
    _id?: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ) {
    const url = new URL(`/v1/attestations/${messageHash}`, this.config.apiUrl)

    // Apply timeout to fetch
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)
    let response: Response
    try {
      response = await fetch(url, { signal: controller.signal } as any)
    } catch (error) {
      // Treat timeouts as pending to allow polling
      if ((error as any)?.name === 'AbortError') {
        // Timeout handling - return pending status
        // Logging will be handled by decorator
        return { status: 'pending' as const }
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }

    // If API has not indexed the message yet, it may return 404 or an error string.
    if (!response.ok) {
      if (response.status === 404) {
        // Message not found - return pending status
        // Logging will be handled by decorator
        return { status: 'pending' as const }
      }
      throw new Error(`CCTP attestation API request failed with status ${response.statusText}`)
    }

    const data:
      | { status: 'pending' }
      | { error: string }
      | { status: 'complete'; attestation: Hex } = await response.json()

    if ('error' in data) {
      if (/not found/i.test(data.error)) {
        // Error indicates message not found - return pending status
        // Logging will be handled by decorator
        return { status: 'pending' as const }
      }
      throw new Error(data.error)
    }

    return data
  }

  private getMessageHash(messageBytes: Hex) {
    return keccak256(messageBytes)
  }

  private getMessageBytes(receipt: TransactionReceipt) {
    const [messageSentEvent] = parseEventLogs({
      abi: CCTPMessageTransmitterABI,
      eventName: 'MessageSent',
      logs: receipt.logs,
    })
    return messageSentEvent.args.message
  }

  /**
   * Receive message from CCTP. It does not wait for the transaction receipt.
   * @param chainId Chain ID
   * @param messageBytes Message bytes
   * @param attestation Attestation
   * @param id Job ID
   * @returns Transaction hash
   */
  @LogOperation('provider_execution', LiquidityManagerLogger)
  async receiveMessage(
    @LogContext chainId: number,
    messageBytes: Hex,
    attestation: Hex,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    id?: string,
  ): Promise<Hex> {
    const cctpChainConfig = this.getChainConfig(chainId)
    const walletClient = await this.walletClientService.getClient(chainId)

    return await walletClient.writeContract({
      abi: CCTPMessageTransmitterABI,
      address: cctpChainConfig.messageTransmitter,
      functionName: 'receiveMessage',
      args: [messageBytes, attestation],
    })
  }

  @LogOperation('provider_validation', LiquidityManagerLogger)
  async getTxReceipt(@LogContext chainId: number, @LogContext txHash: Hex) {
    const publicClient = await this.walletClientService.getPublicClient(chainId)
    return publicClient.waitForTransactionReceipt({ hash: txHash })
  }

  private isSupportedToken(chainId: number, token: Hex) {
    return this.config.chains.some(
      (chain) => chain.chainId === chainId && isAddressEqual(token, chain.token),
    )
  }
}
