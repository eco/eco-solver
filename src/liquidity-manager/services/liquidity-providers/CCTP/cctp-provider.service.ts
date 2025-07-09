import { Injectable, Logger } from '@nestjs/common'
import {
  encodeFunctionData,
  erc20Abi,
  Hex,
  isAddressEqual,
  keccak256,
  pad,
  parseEventLogs,
  TransactionReceipt,
  TransactionRequest,
} from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
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
import { normalizeBalanceToBase } from '@/fee/utils'

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

    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.config = this.ecoConfigService.getCCTP()
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
  }

  getStrategy() {
    return 'CCTP' as const
  }

  /**
   * Gets a quote for swapping tokens using the CCTP strategy
   * @param tokenIn - The input token data including address, decimals, and chain information
   * @param tokenOut - The output token data including address, decimals, and chain information
   * @param swapAmountBased - The amount to swap that has already been normalized to the base token's decimals
   *                          using {@link normalizeBalanceToBase} with {@link BASE_DECIMALS} (18 decimals).
   *                          This represents the tokenIn amount and is ready for direct use in swap calculations.
   * @param id - Optional identifier for tracking the quote request
   * @returns A promise resolving to a single CCTP rebalance quote
   */
  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmountBased: bigint,
    id?: string,
  ): Promise<RebalanceQuote<'CCTP'>> {
    if (
      !this.isSupportedToken(tokenIn.config.chainId, tokenIn.config.address) ||
      !this.isSupportedToken(tokenOut.config.chainId, tokenOut.config.address)
    ) {
      throw new Error('Unsupported route')
    }

    const amountIn = normalizeBalanceToBase({
      balance: swapAmountBased,
      decimal: tokenIn.balance.decimals,
    })
    const amountOut = normalizeBalanceToBase({
      balance: swapAmountBased,
      decimal: tokenOut.balance.decimals,
    })

    return {
      amountIn: amountIn.balance,
      amountOut: amountOut.balance,
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

    await this.liquidityManagerQueue.startCCTPAttestationCheck({
      destinationChainId: quote.tokenOut.chainId,
      messageHash,
      messageBody,
      id: quote.id,
    })
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

  async receiveMessage(chainId: number, messageBytes: Hex, attestation: Hex) {
    const cctpChainConfig = this.getChainConfig(chainId)
    const walletClient = await this.walletClientService.getClient(chainId)
    const publicClient = await this.walletClientService.getPublicClient(chainId)

    const txHash = await walletClient.writeContract({
      abi: CCTPMessageTransmitterABI,
      address: cctpChainConfig.messageTransmitter,
      functionName: 'receiveMessage',
      args: [messageBytes, attestation],
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })
    return txHash
  }

  private isSupportedToken(chainId: number, token: Hex) {
    return this.config.chains.some(
      (chain) => chain.chainId === chainId && isAddressEqual(token, chain.token),
    )
  }
}
