import { Injectable, Logger } from '@nestjs/common'
import { Hex, encodeFunctionData, keccak256, parseUnits } from 'viem'
import { randomBytes } from 'crypto'
import { IntentSourceAbi } from '@eco-foundation/routes-ts'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { LiquidityManagerConfig } from '@/eco-configs/eco-config.types'
import { getERC20Selector } from '@/contracts'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { LitActionService } from '@/lit-actions/lit-action.service'

@Injectable()
export class RebalancingProviderService implements IRebalanceProvider<'Rebalancing'> {
  private logger = new Logger(RebalancingProviderService.name)
  private config: LiquidityManagerConfig

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly publicClient: MultichainPublicClientService,
    private readonly litActionService: LitActionService,
  ) {
    this.config = this.ecoConfigService.getLiquidityManager()
  }

  getStrategy() {
    return 'Rebalancing' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'Rebalancing'>> {
    // Get the rebalancing percentage from config (default to 5% if not set)
    const rebalancingPercentage = this.config.rebalancingPercentage || 0.05

    // Parse amounts with proper decimals
    const amountIn = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)
    // Calculate the amount the fulfiller will receive (less than they spend)
    const amountOutRaw = swapAmount * (1 - rebalancingPercentage)
    const amountOut = parseUnits(amountOutRaw.toString(), tokenOut.balance.decimals)

    return {
      amountIn,
      amountOut,
      slippage: rebalancingPercentage, // The loss percentage is effectively the slippage
      tokenIn,
      tokenOut,
      strategy: this.getStrategy(),
      context: {
        intentHash: '0x' as Hex, // Will be set when intent is published
        rebalancingPercentage,
      },
      id,
    }
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'Rebalancing'>): Promise<Hex> {
    // Only the crowd liquidity pool can execute rebalancing intents
    const crowdLiquidityPoolAddress = this.getCrowdLiquidityPoolAddress()
    if (walletAddress !== crowdLiquidityPoolAddress) {
      throw new Error('Rebalancing intents can only be executed by the crowd liquidity pool')
    }

    return this.publishRebalancingIntent(quote)
  }

  /**
   * Creates and publishes a rebalancing intent that incentivizes fulfillers to take a loss
   * in order to rebalance their portfolios and the crowd liquidity pool.
   *
   * @param quote - The rebalancing quote
   * @returns Transaction hash of the published intent
   */
  private async publishRebalancingIntent(quote: RebalanceQuote<'Rebalancing'>): Promise<Hex> {
    const { tokenIn, tokenOut, amountIn, amountOut, context } = quote

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Publishing rebalancing intent',
        properties: {
          tokenIn: tokenIn.config,
          tokenOut: tokenOut.config,
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          rebalancingPercentage: context.rebalancingPercentage,
          id: quote.id,
        },
      }),
    )

    // Validate that amountOut < amountIn (fulfiller takes a loss)
    if (amountOut >= amountIn) {
      throw new Error('Rebalancing intent must have amountOut < amountIn')
    }

    // Get the intent source contract for the source chain
    const intentSource = this.getIntentSource(tokenIn.chainId)
    if (!intentSource) {
      throw new Error(`No intent source found for chain ${tokenIn.chainId}`)
    }

    // Generate salt for uniqueness
    const salt = this.generateSalt()

    // Create the route - fulfiller must send tokenIn
    const route = {
      salt,
      source: BigInt(tokenIn.chainId),
      destination: BigInt(tokenOut.chainId),
      inbox: intentSource.inbox,
      tokens: [
        {
          token: tokenIn.config.address,
          amount: amountIn,
        },
      ],
      calls: [
        {
          target: tokenIn.config.address,
          // Encode transfer(address,uint256) to send tokens to the crowd liquidity pool
          data: `${getERC20Selector('transfer')}${this.getCrowdLiquidityPoolAddress().slice(2).padStart(64, '0')}${amountIn.toString(16).padStart(64, '0')}` as Hex,
          value: 0n,
        },
      ],
    }

    // Create the reward - fulfiller receives tokenOut (less than they spent)
    const reward = {
      creator: await this.getKernelWalletAddress(),
      prover: intentSource.provers[0], // Use first available prover
      deadline: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours from now
      nativeValue: 0n,
      tokens: [
        {
          token: tokenOut.config.address,
          amount: amountOut,
        },
      ],
    }

    // Create the intent object containing both route and reward
    const intent = {
      route,
      reward,
    }

    // Encode the publishAndFund call
    const publishAndFundData = encodeFunctionData({
      abi: IntentSourceAbi,
      functionName: 'publishAndFund',
      args: [intent, false], // intent and allowPartial (false for full funding)
    })

    // Get the kernel wallet client for the source chain
    const kernelClient = await this.kernelAccountClientService.getClient(tokenIn.chainId)

    // Execute the transaction using the kernel wallet
    const txHash = await kernelClient.sendTransaction({
      to: intentSource.sourceAddress,
      data: publishAndFundData,
      value: 0n,
      account: kernelClient.kernelAccount,
      chain: kernelClient.chain,
    })

    const intentHash = this.calculateIntentHash(route)

    // Update the context with the actual intent hash
    if (quote.context) {
      quote.context.intentHash = intentHash
    }

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Rebalancing intent published',
        properties: {
          txHash,
          intentHash,
          id: quote.id,
        },
      }),
    )

    // Wait for transaction confirmation
    await kernelClient.waitForTransactionReceipt({ hash: txHash })

    // Trigger the negative intent rebalance Lit action to fulfill the intent
    await this.triggerNegativeIntentRebalance(intentHash, quote)

    return txHash
  }

  private generateSalt(): Hex {
    return `0x${randomBytes(32).toString('hex')}` as Hex
  }

  private calculateIntentHash(route: any): Hex {
    // Calculate the intent hash the same way the contract does
    const encoded = encodeFunctionData({
      abi: [
        {
          name: 'hashRoute',
          type: 'function',
          inputs: [
            {
              name: 'route',
              type: 'tuple',
              components: [
                { name: 'salt', type: 'bytes32' },
                { name: 'source', type: 'uint256' },
                { name: 'destination', type: 'uint256' },
                { name: 'inbox', type: 'address' },
                {
                  name: 'tokens',
                  type: 'tuple[]',
                  components: [
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                  ],
                },
                {
                  name: 'calls',
                  type: 'tuple[]',
                  components: [
                    { name: 'target', type: 'address' },
                    { name: 'data', type: 'bytes' },
                    { name: 'value', type: 'uint256' },
                  ],
                },
              ],
            },
          ],
          outputs: [{ name: '', type: 'bytes32' }],
          stateMutability: 'pure',
        },
      ],
      functionName: 'hashRoute',
      args: [route],
    })

    return keccak256(encoded)
  }

  private getIntentSource(chainId: number) {
    const intentSources = this.ecoConfigService.getIntentSources()
    return intentSources.find((source) => source.chainID === chainId)
  }

  private async getKernelWalletAddress(): Promise<Hex> {
    return this.kernelAccountClientService.getAddress()
  }

  private getCrowdLiquidityPoolAddress(): Hex {
    return this.ecoConfigService.getCrowdLiquidity().kernel.address as Hex
  }

  private async triggerNegativeIntentRebalance(
    intentHash: Hex,
    quote: RebalanceQuote<'Rebalancing'>,
  ): Promise<void> {
    try {
      const crowdLiquidityConfig = this.ecoConfigService.getCrowdLiquidity()
      const publicClient = await this.publicClient.getClient(quote.tokenOut.chainId)

      // Get fee data for the transaction
      const [feeData, nonce] = await Promise.all([
        this.getFeeData(publicClient),
        publicClient.getTransactionCount({ address: crowdLiquidityConfig.pkp.ethAddress as Hex }),
      ])

      const transactionBase = { ...feeData, nonce, gasLimit: 1_000_000 }

      // Execute the negative intent rebalance Lit action
      const fulfillTxHash = await this.litActionService.executeNegativeIntentRebalanceAction(
        intentHash,
        crowdLiquidityConfig.pkp.publicKey,
        crowdLiquidityConfig.kernel.address,
        transactionBase,
        publicClient,
      )

      this.logger.log(
        EcoLogMessage.fromDefault({
          message: 'Negative intent rebalance Lit action executed',
          properties: {
            intentHash,
            fulfillTxHash,
            id: quote.id,
          },
        }),
      )
    } catch (error) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: 'Failed to execute negative intent rebalance Lit action',
          properties: {
            intentHash,
            error: error.message,
            id: quote.id,
          },
        }),
      )
      // Don't throw - the intent was published successfully, fulfillment failure is logged
    }
  }

  private async getFeeData(publicClient: any) {
    const [block, maxPriorityFeePerGas] = await Promise.all([
      publicClient.getBlock(),
      publicClient.estimateMaxPriorityFeePerGas(),
    ])
    const maxFeePerGas = block.baseFeePerGas! * 2n + maxPriorityFeePerGas

    return {
      type: 2,
      maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
      maxFeePerGas: maxFeePerGas.toString(),
    }
  }
}
