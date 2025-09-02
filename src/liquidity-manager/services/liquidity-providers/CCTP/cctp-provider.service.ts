import { Injectable, Logger } from '@nestjs/common'
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
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { CheckCCTPAttestationJobData } from '@/liquidity-manager/jobs/check-cctp-attestation.job'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { CCTPTokenMessengerABI } from '@/contracts/CCTPTokenMessenger'
import { CCTPConfig } from '@/eco-configs/eco-config.types'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { CCTPMessageTransmitterABI } from '@/contracts/CCTPMessageTransmitter'
import { InjectQueue } from '@nestjs/bullmq'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'

@Injectable()
export class CCTPProviderService implements IRebalanceProvider<'CCTP'> {
  private logger = new Logger(CCTPProviderService.name)

  private config: CCTPConfig
  private liquidityManagerQueue: LiquidityManagerQueue

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly walletClientService: WalletClientDefaultSignerService,
    private readonly crowdLiquidityService: CrowdLiquidityService,
    private readonly rebalanceRepository: RebalanceRepository,

    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.config = this.ecoConfigService.getCCTP()
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
  }

  getStrategy() {
    return 'CCTP' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'CCTP'>> {
    if (
      !this.isSupportedToken(tokenIn.config.chainId, tokenIn.config.address) ||
      !this.isSupportedToken(tokenOut.config.chainId, tokenOut.config.address)
    ) {
      throw new Error('Unsupported route')
    }

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
      id,
    }
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'CCTP'>) {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPProviderService: executing quote',
        id: quote.id,
        properties: {
          groupID: quote.groupID,
          rebalanceJobID: quote.rebalanceJobID,
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
  async executeWithMetadata(
    walletAddress: string,
    quote: RebalanceQuote<'CCTP'>,
  ): Promise<{ txHash: Hex; messageHash: Hex; messageBody: Hex }> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPProviderService: executing quote with metadata',
        id: quote.id,
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
    const txHash = await this._execute(walletAddress, quote)
    const txReceipt = await client.waitForTransactionReceipt({ hash: txHash })
    const messageBody = this.getMessageBytes(txReceipt)
    const messageHash = this.getMessageHash(messageBody)

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTPProviderService: Transaction metadata extracted',
        id: quote.id,
        properties: {
          txHash,
          messageHash,
          messageBodyLength: messageBody.length,
        },
      }),
    )

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

  async fetchAttestation(messageHash: Hex) {
    const url = new URL(`/v1/attestations/${messageHash}`, this.config.apiUrl)
    const response = await fetch(url)
    const data:
      | { status: 'pending' }
      | { error: string }
      | { status: 'complete'; attestation: Hex } = await response.json()

    if ('error' in data) {
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
  async receiveMessage(
    chainId: number,
    messageBytes: Hex,
    attestation: Hex,
    id?: string,
  ): Promise<Hex> {
    const cctpChainConfig = this.getChainConfig(chainId)
    const walletClient = await this.walletClientService.getClient(chainId)

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCTP: receiveMessage: submitting',
        id,
        properties: {
          chainId,
          messageTransmitter: cctpChainConfig.messageTransmitter,
          sender: (walletClient as any).account?.address,
          attestation,
          messageBytes,
        },
      }),
    )

    return await walletClient.writeContract({
      abi: CCTPMessageTransmitterABI,
      address: cctpChainConfig.messageTransmitter,
      functionName: 'receiveMessage',
      args: [messageBytes, attestation],
    })
  }

  async getTxReceipt(chainId: number, txHash: Hex) {
    const publicClient = await this.walletClientService.getPublicClient(chainId)
    return publicClient.waitForTransactionReceipt({ hash: txHash })
  }

  private isSupportedToken(chainId: number, token: Hex) {
    return this.config.chains.some(
      (chain) => chain.chainId === chainId && isAddressEqual(token, chain.token),
    )
  }
}
