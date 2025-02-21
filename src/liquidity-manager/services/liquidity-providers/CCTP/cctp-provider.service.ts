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

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote<'CCTP'>> {
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

  async execute(walletAddress: string, quote: RebalanceQuote<'CCTP'>) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'CCTPProviderService: executing quote',
        properties: {
          tokenIn: quote.tokenIn.config.address,
          chainIn: quote.tokenIn.config.chainId,
          tokenOut: quote.tokenIn.config.address,
          chainOut: quote.tokenIn.config.chainId,
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
    })
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

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.config.chainId)

    // Make sure the Kernel wallet is used
    if (walletAddress !== client.account?.address) {
      throw new Error('Unexpected wallet during CCTP execution')
    }

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
}
