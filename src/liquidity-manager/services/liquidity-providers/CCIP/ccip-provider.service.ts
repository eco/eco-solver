import { Injectable, Logger } from '@nestjs/common'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RebalanceQuote, TokenData, CCIPStrategyContext } from '@/liquidity-manager/types/types'
import {
  Hex,
  encodeAbiParameters,
  encodeFunctionData,
  erc20Abi,
  isAddressEqual,
  parseAbi,
  parseEventLogs,
  parseUnits,
  zeroAddress,
  zeroHash,
} from 'viem'
import { CCIPConfig, CCIPChainConfig, CCIPTokenConfig } from '@/eco-configs/eco-config.types'
import { createClient as createCcipClient } from './ccip-client'
import {
  ONRAMP_ABI_V1_5,
  ONRAMP_ABI_V1_6,
  ROUTER_ABI,
  TRANSFER_STATUS_FROM_BLOCK_SHIFT,
} from './ccip-abis'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { LmTxGatedKernelAccountClientService } from '@/liquidity-manager/wallet-wrappers/kernel-gated-client.service'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { InjectQueue } from '@nestjs/bullmq'
import {
  LiquidityManagerQueue,
  LiquidityManagerQueueType,
} from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CheckCCIPDeliveryJobData } from '@/liquidity-manager/jobs/check-ccip-delivery.job'
import { RebalanceRepository } from '@/liquidity-manager/repositories/rebalance.repository'
import { RebalanceStatus } from '@/liquidity-manager/enums/rebalance-status.enum'
import { TransactionReceipt } from 'viem'

// CCIPProviderService:
// - Implements an `IRebalanceProvider<'CCIP'>` that bridges same-token balances (e.g. USDC → USDC)
//   between configured chains using Chainlink CCIP token transfers.
// - Uses a lightweight in-repo `ccipClient` for fee estimation, on-ramp lookups, and status reads.
// - Executes via a Kernel AA client and defers terminal success / failure to a BullMQ delivery job.
@Injectable()
export class CCIPProviderService implements IRebalanceProvider<'CCIP'> {
  private readonly logger = new Logger(CCIPProviderService.name)
  private readonly ccipClient = createCcipClient()
  private liquidityManagerQueue: LiquidityManagerQueue

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly publicClientService: MultichainPublicClientService,
    private readonly kernelAccountClientService: LmTxGatedKernelAccountClientService,
    private readonly rebalanceRepository: RebalanceRepository,
    @InjectQueue(LiquidityManagerQueue.queueName)
    private readonly queue: LiquidityManagerQueueType,
  ) {
    this.liquidityManagerQueue = new LiquidityManagerQueue(queue)
  }

  getStrategy() {
    return 'CCIP' as const
  }

  /**
   * Checks if a CCIP route is available between the given tokens.
   * Returns true if both chains and tokens are configured, compatible,
   * and the CCIP lane exists (destination is in supportedDestinations).
   */
  async isRouteAvailable(tokenIn: TokenData, tokenOut: TokenData): Promise<boolean> {
    const config = this.ecoConfigService.getCCIP()

    // CCIP must be enabled
    if (config.enabled === false) {
      return false
    }

    // Same-chain routes are not supported
    if (tokenIn.chainId === tokenOut.chainId) {
      return false
    }

    // Check source chain is configured
    const sourceChain = config.chains.find((c) => c.chainId === tokenIn.chainId)
    if (!sourceChain) {
      return false
    }

    // Check destination chain is configured
    const destinationChain = config.chains.find((c) => c.chainId === tokenOut.chainId)
    if (!destinationChain) {
      return false
    }

    // Check source token is configured
    const sourceToken = Object.values(sourceChain.tokens).find((t) =>
      isAddressEqual(t.address as Hex, tokenIn.config.address as Hex),
    )
    if (!sourceToken) {
      return false
    }

    // Check destination token is configured
    const destinationToken = Object.values(destinationChain.tokens).find((t) =>
      isAddressEqual(t.address as Hex, tokenOut.config.address as Hex),
    )
    if (!destinationToken) {
      return false
    }

    // CCIP requires same-token routes (same symbol)
    if (sourceToken.symbol !== destinationToken.symbol) {
      return false
    }

    // Check that the CCIP lane is not denied
    // If deniedDestinations is not configured or empty, all destinations are supported
    if (
      sourceToken.deniedDestinations &&
      sourceToken.deniedDestinations.includes(tokenOut.chainId)
    ) {
      return false
    }

    return true
  }

  /**
   * Generates a quote for a CCIP rebalance.
   * Validates chain/token support, estimates fees via the CCIP client, and constructs the quote.
   */
  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote<'CCIP'>> {
    const config = this.ecoConfigService.getCCIP()
    if (config.enabled === false) {
      throw new Error('CCIP provider disabled')
    }

    if (tokenIn.chainId === tokenOut.chainId) {
      throw new Error('CCIP same-chain routes are not supported')
    }

    const sourceChain = this.requireChainConfig(config, tokenIn.chainId)
    const destinationChain = this.requireChainConfig(config, tokenOut.chainId)

    const sourceToken = this.requireTokenConfig(sourceChain, tokenIn.config.address as Hex)
    const destinationToken = this.requireTokenConfig(
      destinationChain,
      tokenOut.config.address as Hex,
    )

    if (sourceToken.symbol !== destinationToken.symbol) {
      throw new Error('CCIP requires same-token routes')
    }

    const walletAddress = (await this.kernelAccountClientService.getAddress()) as Hex
    const amountIn = parseUnits(String(swapAmount), tokenIn.balance.decimals)
    const amountOut = parseUnits(String(swapAmount), tokenOut.balance.decimals)

    // Calculate the estimated fee using the CCIP client.
    // If the chain supports native fee payment, we use that (feeTokenAddress undefined).
    // Otherwise, we resolve the configured fee token.
    const feeToken = this.resolveFeeToken(sourceChain)
    const feeTokenAddress = feeToken?.address as Hex | undefined
    const publicClient = await this.publicClientService.getClient(tokenIn.chainId)
    const estimatedFee = await this.ccipClient.getFee({
      client: publicClient,
      routerAddress: sourceChain.router as Hex,
      destinationAccount: walletAddress,
      destinationChainSelector: destinationChain.chainSelector,
      tokenAddress: sourceToken.address as Hex,
      amount: amountIn,
      feeTokenAddress,
    })

    const quote: RebalanceQuote<'CCIP'> = {
      amountIn,
      amountOut,
      slippage: 0,
      tokenIn,
      tokenOut,
      strategy: this.getStrategy(),
      context: {
        router: sourceChain.router as Hex,
        sourceChainSelector: sourceChain.chainSelector,
        destinationChainSelector: destinationChain.chainSelector,
        destinationAccount: walletAddress,
        tokenSymbol: sourceToken.symbol,
        tokenAddress: sourceToken.address as Hex,
        amount: amountIn,
        feeTokenAddress,
        feeTokenSymbol: feeToken?.symbol,
        estimatedFee,
      },
      id,
    }

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIP: Prepared quote',
        id,
        properties: {
          sourceChainId: tokenIn.chainId,
          destinationChainId: tokenOut.chainId,
          token: sourceToken.symbol,
          amountIn: amountIn.toString(),
          feeTokenAddress,
          feeTokenSymbol: feeToken?.symbol,
          estimatedFee: estimatedFee.toString(),
        },
      }),
    )

    return quote
  }

  /**
   * Executes the CCIP rebalance transaction.
   * Handles approvals (token & fee token), submits the router transaction,
   * and queues a job to track delivery on the destination chain.
   */
  async execute(walletAddress: string, quote: RebalanceQuote<'CCIP'>): Promise<Hex> {
    const ccipQuoteContext = quote.context as CCIPStrategyContext
    const config = this.ecoConfigService.getCCIP()
    const sourceChain = this.requireChainConfig(config, quote.tokenIn.chainId)
    const destinationChain = this.requireChainConfig(config, quote.tokenOut.chainId)
    try {
      // Capture the destination chain block number *before* the CCIP message can be delivered.
      // This guarantees that our fromBlock is always at or before the eventual ExecutionStateChanged
      // event, avoiding races where the event is emitted before we determine the starting block.
      const destinationClient = await this.publicClientService.getClient(quote.tokenOut.chainId)
      const destinationBlockNumber = await destinationClient.getBlockNumber()
      const deliveryFromBlockNumber =
        destinationBlockNumber > TRANSFER_STATUS_FROM_BLOCK_SHIFT
          ? destinationBlockNumber - TRANSFER_STATUS_FROM_BLOCK_SHIFT
          : 0n

      const kernelWalletAddress = await this.kernelAccountClientService.getAddress()
      if (!isAddressEqual(kernelWalletAddress as Hex, walletAddress as Hex)) {
        throw new Error('Unexpected wallet during CCIP execution')
      }

      this.ensureQuoteIdentifiers(quote)

      const walletAddressHex = walletAddress as Hex
      const calls: { to: Hex; data: Hex; value?: bigint }[] = []

      // 1. Check and handle Token Allowance
      const tokenAllowanceSatisfied = await this.hasSufficientAllowance({
        chainId: quote.tokenIn.chainId,
        tokenAddress: ccipQuoteContext.tokenAddress,
        owner: walletAddressHex,
        spender: ccipQuoteContext.router,
        amount: ccipQuoteContext.amount,
        quoteId: quote.id,
        tokenSymbol: ccipQuoteContext.tokenSymbol,
      })

      if (!tokenAllowanceSatisfied) {
        calls.push(
          this.buildApproveCall({
            tokenAddress: ccipQuoteContext.tokenAddress,
            spender: ccipQuoteContext.router,
            amount: ccipQuoteContext.amount,
            walletAddress: walletAddressHex,
            id: quote.id,
            tokenSymbol: ccipQuoteContext.tokenSymbol,
          }),
        )
      }

      // 2. Refresh fee estimation immediately before execution to ensure accuracy
      const refreshedFee = await this.computeFee(quote, ccipQuoteContext)

      // 3. Check and handle Fee Token Allowance (if applicable)
      if (ccipQuoteContext.feeTokenAddress) {
        const feeAllowanceSatisfied = await this.hasSufficientAllowance({
          chainId: quote.tokenIn.chainId,
          tokenAddress: ccipQuoteContext.feeTokenAddress,
          owner: walletAddressHex,
          spender: ccipQuoteContext.router,
          amount: refreshedFee,
          quoteId: quote.id,
          tokenSymbol: ccipQuoteContext.feeTokenSymbol ?? 'fee token',
        })

        if (!feeAllowanceSatisfied && refreshedFee > 0n) {
          calls.push(
            this.buildApproveCall({
              tokenAddress: ccipQuoteContext.feeTokenAddress,
              spender: ccipQuoteContext.router,
              amount: refreshedFee,
              walletAddress: walletAddressHex,
              id: quote.id,
              tokenSymbol: ccipQuoteContext.feeTokenSymbol ?? 'fee token',
            }),
          )
        }
      }

      // 4. Build CCIP Router call
      calls.push(this.buildCcipSendCall(quote, ccipQuoteContext, refreshedFee, quote.id))

      const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)
      const txHash = (await client.execute(calls)) as Hex
      this.logger.log(
        EcoLogMessage.withId({
          message: 'CCIP: Submitted router transactions',
          id: quote.id,
          properties: { txHash, sourceChainId: quote.tokenIn.chainId },
        }),
      )

      let receipt: TransactionReceipt
      try {
        receipt = (await client.waitForTransactionReceipt({
          hash: txHash,
          timeout: 600_000,
        })) as TransactionReceipt
      } catch (waitError) {
        this.logger.error(
          EcoLogMessage.withErrorAndId({
            message: 'CCIP: router transaction receipt timeout',
            id: quote.id,
            error: waitError as any,
            properties: {
              txHash,
              sourceChainId: quote.tokenIn.chainId,
            },
          }),
        )
        throw new Error('CCIP: timed out waiting for router transaction receipt')
      }

      // 5. Extract Message ID from logs to track delivery
      const messageId = await this.extractMessageId(quote, ccipQuoteContext, receipt, sourceChain)

      const jobData: CheckCCIPDeliveryJobData = {
        groupID: quote.groupID,
        rebalanceJobID: quote.rebalanceJobID,
        sourceChainId: quote.tokenIn.chainId,
        destinationChainId: quote.tokenOut.chainId,
        sourceChainSelector: ccipQuoteContext.sourceChainSelector,
        destinationChainSelector: ccipQuoteContext.destinationChainSelector,
        sourceRouter: ccipQuoteContext.router as Hex,
        destinationRouter: destinationChain.router as Hex,
        messageId,
        txHash,
        walletAddress: ccipQuoteContext.destinationAccount,
        id: quote.id,
        fromBlockNumber: deliveryFromBlockNumber.toString(),
        ccipLiFiContext: ccipQuoteContext.ccipLiFiContext,
      }

      const { delivery } = config
      await this.liquidityManagerQueue.startCCIPDeliveryCheck(jobData, {
        initialDelayMs: delivery.initialDelayMs,
        queueAttempts: delivery.queueAttempts,
        queueBackoffMs: delivery.queueBackoffMs,
      })

      return txHash
    } catch (error) {
      this.logger.error(
        EcoLogMessage.withErrorAndId({
          message: 'CCIP: execution failed',
          id: quote.id,
          error: error as any,
          properties: {
            sourceChainId: quote.tokenIn.chainId,
            destinationChainId: quote.tokenOut.chainId,
            rebalanceJobID: quote.rebalanceJobID,
          },
        }),
      )
      try {
        if (quote.rebalanceJobID) {
          await this.rebalanceRepository.updateStatus(quote.rebalanceJobID, RebalanceStatus.FAILED)
        }
      } catch (updateError) {
        this.logger.warn(
          EcoLogMessage.withErrorAndId({
            message: 'CCIP: failed to update rebalance status after execution error',
            id: quote.id,
            error: updateError as any,
          }),
        )
      }
      throw error
    }
  }

  /**
   * Ensures that a quote contains the identifiers we require to tie CCIP activity back to
   * a specific rebalance job / group. This is a defensive guard so we never enqueue delivery
   * jobs that cannot be correlated in the DB.
   */
  private ensureQuoteIdentifiers(
    quote: RebalanceQuote<'CCIP'>,
  ): asserts quote is RebalanceQuote<'CCIP'> & {
    groupID: string
    rebalanceJobID: string
  } {
    if (quote.groupID && quote.rebalanceJobID) {
      return
    }

    const missingFields = [
      !quote.groupID ? 'groupID' : null,
      !quote.rebalanceJobID ? 'rebalanceJobID' : null,
    ].filter(Boolean)

    const error = new Error(`CCIP: missing required quote identifiers: ${missingFields.join(', ')}`)

    this.logger.error(
      EcoLogMessage.withErrorAndId({
        message: 'CCIP: unable to execute due to missing identifiers',
        id: quote.id,
        error,
        properties: {
          quoteId: quote.id,
          groupID: quote.groupID,
          rebalanceJobID: quote.rebalanceJobID,
        },
      }),
    )

    throw error
  }

  /**
   * Reads ERC-20 allowance for a token and returns true when it is at least `amount`.
   * If the read fails (e.g. non-standard token), we pessimistically return false so that
   * the caller will schedule an `approve` transaction instead of assuming the allowance.
   */
  private async hasSufficientAllowance(params: {
    chainId: number
    tokenAddress: Hex
    owner: Hex
    spender: Hex
    amount: bigint
    quoteId?: string
    tokenSymbol?: string
  }) {
    if (params.amount <= 0n) {
      return true
    }
    try {
      const publicClient = await this.publicClientService.getClient(params.chainId)
      const allowance = (await publicClient.readContract({
        address: params.tokenAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [params.owner, params.spender],
      })) as bigint
      return allowance >= params.amount
    } catch (error) {
      this.logger.warn(
        EcoLogMessage.withErrorAndId({
          message: `CCIP: allowance check failed for ${params.tokenSymbol ?? 'token'}, continuing with approval`,
          id: params.quoteId,
          error: error as any,
        }),
      )
      return false
    }
  }

  /**
   * Builds an `ERC20.approve(spender, amount)` call encoded for inclusion in a Kernel AA batch.
   * All logging is done here so callers do not need to duplicate structured logs per token.
   */
  private buildApproveCall(params: {
    tokenAddress: Hex
    spender: Hex
    amount: bigint
    walletAddress: Hex
    id?: string
    tokenSymbol?: string
  }) {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIP: adding approve call',
        id: params.id,
        properties: {
          token: params.tokenSymbol,
          spender: params.spender,
          amount: params.amount.toString(),
          walletAddress: params.walletAddress,
        },
      }),
    )

    return {
      to: params.tokenAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [params.spender, params.amount],
      }),
    }
  }

  /**
   * Constructs the Router `ccipSend` call and wraps it in a call object suitable for
   * `kernelAccountClientService.execute`. If a fee token is configured we send `value = 0`
   * and assume fees are paid in ERC-20; otherwise the fee is attached as native value.
   */
  private buildCcipSendCall(
    quote: RebalanceQuote<'CCIP'>,
    context: CCIPStrategyContext,
    fee: bigint,
    id?: string,
  ) {
    const args = this.buildRouterArgs(context)
    const callData = encodeFunctionData({
      abi: ROUTER_ABI as any,
      functionName: 'ccipSend',
      args,
    })

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIP: adding router call',
        id,
        properties: {
          fee,
          router: context.router,
          token: context.tokenAddress,
          destinationChainSelector: context.destinationChainSelector,
        },
      }),
    )

    return {
      to: context.router,
      data: callData,
      value: context.feeTokenAddress ? undefined : fee,
    }
  }

  /**
   * Builds the strongly-typed Router arguments for `ccipSend`:
   * - Encodes the receiver address as ABI bytes.
   * - Sets `tokenAmounts` to a single token transfer (no multi-asset support yet).
   * - Encodes extraArgs with a 0 gas limit and `allowOutOfOrderExecution = true`, matching
   *   the default CCIP EVM2EVM on-ramp expectations for simple token transfers.
   */
  private buildRouterArgs(context: CCIPStrategyContext) {
    const encodedReceiver = encodeAbiParameters(
      [{ type: 'address', name: 'receiver' }],
      [context.destinationAccount],
    )
    const destinationChainSelector = BigInt(context.destinationChainSelector)
    const gasLimit = 0n
    const allowOutOfOrderExecution = true
    const encodedExtraArgs = encodeAbiParameters(
      [
        { type: 'uint256', name: 'gasLimit' },
        { type: 'bool', name: 'allowOutOfOrderExecution' },
      ],
      [gasLimit, allowOutOfOrderExecution],
    )
    const extraArgsTag = '0x181dcf10'
    const extraArgs = (extraArgsTag + encodedExtraArgs.slice(2)) as Hex

    return [
      destinationChainSelector,
      {
        receiver: encodedReceiver,
        data: zeroHash,
        tokenAmounts: [{ token: context.tokenAddress, amount: context.amount }],
        feeToken: context.feeTokenAddress ?? zeroAddress,
        extraArgs,
      },
    ]
  }

  /**
   * Re-computes CCIP fees just-in-time for execution, using the same parameters that were
   * used at quote time but with the latest on-chain pricing. This keeps the quote context
   * authoritative while still avoiding stale fee estimates at submission time.
   */
  private async computeFee(
    quote: RebalanceQuote<'CCIP'>,
    context: CCIPStrategyContext,
  ): Promise<bigint> {
    const publicClient = await this.publicClientService.getClient(quote.tokenIn.chainId)
    const fee = await this.ccipClient.getFee({
      client: publicClient,
      routerAddress: context.router,
      destinationAccount: context.destinationAccount,
      destinationChainSelector: context.destinationChainSelector,
      tokenAddress: context.tokenAddress,
      amount: context.amount,
      feeTokenAddress: context.feeTokenAddress,
    })
    return fee
  }

  /**
   * Known CCIP on-ramp version patterns and their corresponding parsing strategies.
   * v1.5.x uses flat `message.messageId`, v1.6.x uses nested `message.header.messageId`.
   */
  private static readonly ONRAMP_VERSION_PATTERNS = {
    V1_5: /^EVM2EVMOnRamp 1\.5\.\d+$/,
    V1_6: /^EVM2EVMOnRamp 1\.6\.\d+$|^OnRamp 1\.6\.\d+$/,
  } as const

  /**
   * Derives the CCIP `messageId` from the on-ramp event emitted by the router transaction.
   * We:
   * - Discover the on-ramp address via the router + destination selector.
   * - Inspect `typeAndVersion()` to decide which event name / ABI to decode.
   * - Parse logs and normalise the messageId across v1.5 and v1.6 on-ramp flavours.
   *
   * For unrecognised versions, we attempt v1.6 parsing with a warning since newer
   * versions are more likely to follow the v1.6 structure than regress to v1.5.
   */
  private async extractMessageId(
    quote: RebalanceQuote<'CCIP'>,
    context: CCIPStrategyContext,
    receipt: TransactionReceipt,
    sourceChain: CCIPChainConfig,
  ): Promise<Hex> {
    const publicClient = await this.publicClientService.getClient(quote.tokenIn.chainId)
    const onRampAddress = await this.ccipClient.getOnRampAddress({
      client: publicClient,
      routerAddress: context.router,
      destinationChainSelector: context.destinationChainSelector,
    })

    const typeAndVersion = (await publicClient.readContract({
      abi: parseAbi(['function typeAndVersion() view returns (string)']),
      address: onRampAddress as Hex,
      functionName: 'typeAndVersion',
    })) as string

    const versionStrategy = this.resolveOnRampVersionStrategy(typeAndVersion, quote.id)
    const parsedLogs = parseEventLogs({
      abi: versionStrategy.abi as any,
      logs: receipt.logs,
      eventName: versionStrategy.eventName,
    }) as any[]

    if (!Array.isArray(parsedLogs) || !parsedLogs.length || !parsedLogs[0]?.args) {
      throw new Error(
        `CCIP: No parsed event logs found for router transaction (onRamp version: ${typeAndVersion})`,
      )
    }

    const message = parsedLogs[0]?.args?.message as any
    const messageId = this.extractMessageIdFromEvent(message, versionStrategy.variant)

    if (!messageId) {
      throw new Error(
        `CCIP: Unable to extract messageId from router transaction. ` +
          `onRamp version "${typeAndVersion}" may use an unsupported event structure. ` +
          `Please update CCIP provider to support this version.`,
      )
    }

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'CCIP: extracted messageId',
        id: quote.id,
        properties: {
          messageId,
          sourceChainId: sourceChain.chainId,
          onRampVersion: typeAndVersion,
        },
      }),
    )

    return messageId
  }

  /**
   * Resolves the parsing strategy (ABI, event name, message structure variant)
   * for a given on-ramp typeAndVersion string.
   */
  private resolveOnRampVersionStrategy(
    typeAndVersion: string,
    quoteId: string | undefined,
  ): { abi: any; eventName: string; variant: 'v1.5' | 'v1.6' } {
    if (CCIPProviderService.ONRAMP_VERSION_PATTERNS.V1_5.test(typeAndVersion)) {
      return { abi: ONRAMP_ABI_V1_5, eventName: 'CCIPSendRequested', variant: 'v1.5' }
    }

    if (CCIPProviderService.ONRAMP_VERSION_PATTERNS.V1_6.test(typeAndVersion)) {
      return { abi: ONRAMP_ABI_V1_6, eventName: 'CCIPMessageSent', variant: 'v1.6' }
    }

    // Unrecognised version: log a warning and attempt v1.6 parsing as a best-effort fallback.
    // Newer Chainlink versions are more likely to follow v1.6 structure than v1.5.
    this.logger.warn(
      EcoLogMessage.withId({
        message:
          'CCIP: Unrecognised onRamp version detected. Attempting v1.6 parsing as fallback. ' +
          'Consider updating the CCIP provider to explicitly support this version.',
        id: quoteId ?? 'unknown',
        properties: { typeAndVersion },
      }),
    )
    return { abi: ONRAMP_ABI_V1_6, eventName: 'CCIPMessageSent', variant: 'v1.6' }
  }

  /**
   * Extracts the messageId from the parsed event message based on the version variant.
   * v1.5 stores messageId directly on the message, v1.6 nests it under header.
   */
  private extractMessageIdFromEvent(message: any, variant: 'v1.5' | 'v1.6'): Hex | undefined {
    if (variant === 'v1.5') {
      return message?.messageId as Hex | undefined
    }
    // v1.6 and fallback: try header.messageId first, then direct messageId as last resort
    return (message?.header?.messageId ?? message?.messageId) as Hex | undefined
  }

  /**
   * Fetches the CCIP chain configuration for a given chainId or throws with a clear,
   * operator-friendly error if the chain is not configured.
   */
  private requireChainConfig(config: CCIPConfig, chainId: number): CCIPChainConfig {
    const chain = config.chains.find((c) => c.chainId === chainId)
    if (!chain) {
      throw new Error(`CCIP: Chain ${chainId} not configured`)
    }
    return chain
  }

  /**
   * Locates a configured token entry on a CCIP chain by address, using `isAddressEqual`
   * for case-insensitive comparison. This ensures we never silently mis-route an asset
   * if the config and runtime token address diverge.
   */
  private requireTokenConfig(chain: CCIPChainConfig, tokenAddress: Hex): CCIPTokenConfig {
    const token = Object.values(chain.tokens).find((t) =>
      isAddressEqual(t.address as Hex, tokenAddress),
    )
    if (!token) {
      throw new Error(`CCIP: token ${tokenAddress} not configured on chain ${chain.chainId}`)
    }
    return token
  }

  /**
   * Resolves the ERC-20 fee token (if any) for a chain:
   * - When `supportsNativeFee === false` we require a concrete `feeToken` with an address.
   * - When native fee payment is supported we return `undefined` so all calls pay in the
   *   chain's native gas token instead of an ERC-20.
   */
  private resolveFeeToken(chain: CCIPChainConfig) {
    if (chain.supportsNativeFee === false) {
      const token = chain.feeToken
      if (!token?.address) {
        throw new Error(
          `CCIP: feeToken must be configured for chain ${chain.chainId} when native fees are disabled`,
        )
      }
      return token
    }
    return undefined
  }
}
