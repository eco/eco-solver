import { Injectable, Logger } from '@nestjs/common'
import {
  encodeFunctionData,
  erc20Abi,
  getAbiItem,
  Hex,
  isAddressEqual,
  pad,
  parseEventLogs,
  TransactionReceipt,
  TransactionRequest,
  isAddress,
} from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { TokenConfig } from '@/balance/types'
import { BalanceService } from '@/balance/balance.service'
import { hyperlaneCollateralERC20 } from '@/contracts/HyperlaneCollateralERC20'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { HyperlaneMailboxAbi } from '@/contracts/HyperlaneMailbox'
import * as Hyperlane from '@/intent-processor/utils/hyperlane'
import {
  ActionPath,
  WarpRoute,
  WarpRouteResult,
  PARTIAL_QUOTE_PATHS,
  WarpToken,
} from './warp-route.types'
import {
  WarpRouteError,
  WarpRouteNotFoundError,
  UnsupportedActionPathError,
  UnsupportedWalletError,
  MessageDispatchError,
  PartialQuoteError,
  InvalidInputError,
} from './warp-route.errors'
import { withRetry, withTimeout } from './warp-route.utils'

@Injectable()
export class WarpRouteProviderService implements IRebalanceProvider<'WarpRoute'> {
  private logger = new Logger(WarpRouteProviderService.name)

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly liFiProviderService: LiFiProviderService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {}

  getStrategy() {
    return 'WarpRoute' as const
  }

  /**
   * Gets a quote for swapping tokens using the WarpRoute strategy
   * @param tokenIn - The input token data including address, decimals, and chain information
   * @param tokenOut - The output token data including address, decimals, and chain information
   * @param swapAmountBased - The amount to swap that has already been normalized to the base token's decimals
   *                          using {@link normalizeBalanceToBase} with {@link BASE_DECIMALS} (18 decimals).
   *                          This represents the tokenIn amount and is ready for direct use in swap calculations.
   * @param id - Optional identifier for tracking the quote request
   * @returns A promise resolving to an array of WarpRoute rebalance quotes
   */
  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmountBased: bigint,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    // Validate inputs
    this.validateTokenData(tokenIn, 'tokenIn')
    this.validateTokenData(tokenOut, 'tokenOut')
    if (swapAmountBased <= 0) {
      throw new InvalidInputError('Swap amount must be positive', {
        swapAmountBased: swapAmountBased.toString(),
      })
    }
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'WarpRouteProviderService: getting quote',
        id,
        properties: {
          tokenIn,
          tokenOut,
          swapAmountBased,
        },
      }),
    )

    // Get all possible warp routes for both tokens
    const warpRoutesIn = this.getAllWarpRoutes(tokenIn.config.chainId, tokenIn.config.address)
    const warpRoutesOut = this.getAllWarpRoutes(tokenOut.config.chainId, tokenOut.config.address)

    // Determine the correct warp route based on the tokens
    const { warpRouteIn, warpRouteOut, actionPath } = this.determineWarpRoutes(
      warpRoutesIn,
      warpRoutesOut,
    )

    if (actionPath === ActionPath.UNSUPPORTED) {
      throw new UnsupportedActionPathError(tokenIn.config, tokenOut.config)
    }

    if (actionPath === ActionPath.PARTIAL) {
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'WarpRouteProviderService: getting partial quote',
          id,
          properties: { tokenIn, tokenOut, swapAmountBased },
        }),
      )
      const quotes = await this.getPartialQuote(
        tokenIn,
        tokenOut,
        swapAmountBased,
        warpRouteIn,
        warpRouteOut,
        id,
      )
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'WarpRouteProviderService: partial quote generated',
          id,
          properties: { quotes },
        }),
      )
      return quotes
    }

    const quote = this.getRemoteTransferQuote(tokenIn, tokenOut, swapAmountBased, id)

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'WarpRouteProviderService: quote generated',
        id,
        properties: { quote },
      }),
    )

    return [quote]
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'WarpRoute'>) {
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'WarpRouteProviderService: executing quote',
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

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)
    const txHash = await withRetry(
      () => this._execute(walletAddress, quote),
      { maxRetries: 2, retryDelay: 2000 },
      this.logger,
      { operation: 'execute', quote: quote.id },
    )
    const receipt = await withRetry(
      () => client.waitForTransactionReceipt({ hash: txHash }),
      { maxRetries: 3, retryDelay: 5000 },
      this.logger,
      { operation: 'waitForReceipt', txHash },
    )

    const { messageId } = this.getMessageFromReceipt(receipt)

    this.logger.log(
      EcoLogMessage.withId({
        message:
          'WarpRouteProviderService: remote transfer executed, waiting for message to get relayed',
        id: quote.id,
        properties: {
          chainId: quote.tokenIn.config.chainId,
          transactionHash: txHash,
          destinationChainId: quote.tokenOut.config.chainId,
          messageId,
        },
      }),
    )

    // Used to complete the job only after the message is relayed
    await this.waitMessageRelay(quote.tokenOut.config.chainId, messageId)

    this.logger.log(
      EcoLogMessage.withId({
        id: quote.id,
        message: 'WarpRouteProviderService: message relayed',
        properties: {
          chainId: quote.tokenOut.config.chainId,
          transactionHash: txHash,
          messageId,
        },
      }),
    )

    return txHash
  }

  private getRemoteTransferQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmountBased: bigint,
    id?: string,
  ): RebalanceQuote<'WarpRoute'> {
    return {
      amountIn: swapAmountBased,
      amountOut: swapAmountBased,
      slippage: 0,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      strategy: this.getStrategy(),
      context: undefined,
      id,
    }
  }

  private async _execute(walletAddress: string, quote: RebalanceQuote<'WarpRoute'>) {
    if (!isAddress(walletAddress)) {
      throw new InvalidInputError('Invalid wallet address', { walletAddress })
    }

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

    if (isAddressEqual(client.kernelAccountAddress, walletAddress as Hex)) {
      return this.executeWithKernel(walletAddress as Hex, quote)
    }

    throw new UnsupportedWalletError(walletAddress)
  }

  private async executeWithKernel(walletAddress: Hex, quote: RebalanceQuote<'WarpRoute'>) {
    const transactions = await this.executeRemoteTransfer(
      quote.tokenIn.config,
      quote.tokenOut.config.chainId,
      walletAddress,
      quote.amountOut,
    )

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

    // Make sure the Kernel wallet is used
    if (!isAddressEqual(client.kernelAccountAddress, walletAddress)) {
      throw new UnsupportedWalletError(walletAddress)
    }

    return client.execute(
      transactions.map((tx) => ({ to: tx.to!, data: tx.data ?? '0x', value: tx.value })),
    )
  }

  private async executeRemoteTransfer(
    tokenIn: TokenConfig,
    destinationChainId: number,
    recipient: Hex,
    amount: bigint,
  ): Promise<TransactionRequest[]> {
    const client = await this.kernelAccountClientService.getClient(tokenIn.chainId)
    const { warpToken } = this.getWarpRoute(tokenIn.chainId, tokenIn.address)

    if (!warpToken) {
      throw new WarpRouteNotFoundError(tokenIn.chainId, tokenIn.address as string)
    }

    // Transfer remote transaction
    const transferRemoteFee = await withRetry(
      () =>
        client.readContract({
          address: warpToken.warpContract,
          abi: hyperlaneCollateralERC20,
          functionName: 'quoteGasPayment',
          args: [destinationChainId],
        }),
      { maxRetries: 3, retryDelay: 1000 },
      this.logger,
      { operation: 'quoteGasPayment', chainId: tokenIn.chainId },
    )

    const transferRemoteData = encodeFunctionData({
      abi: hyperlaneCollateralERC20,
      functionName: 'transferRemote',
      args: [destinationChainId, pad(recipient), amount],
    })

    const transferRemoteTx: TransactionRequest = {
      to: warpToken.warpContract,
      value: transferRemoteFee,
      data: transferRemoteData,
    }

    // Approval: When operating with a collateral token, an allowance must be set for the warp contract
    if (!isAddressEqual(warpToken.warpContract, tokenIn.address)) {
      const approvalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [warpToken.warpContract, amount],
      })

      const approvalTx: TransactionRequest = {
        to: tokenIn.address,
        data: approvalData,
      }

      return [approvalTx, transferRemoteTx]
    }

    // Only return remote transfer transaction
    return [transferRemoteTx]
  }

  private validateTokenData(tokenData: TokenData, fieldName: string): void {
    if (!tokenData) {
      throw new InvalidInputError(`${fieldName} is required`)
    }
    if (!tokenData.config || !isAddress(tokenData.config.address)) {
      throw new InvalidInputError(`Invalid ${fieldName} address`, {
        address: tokenData.config?.address,
      })
    }
    if (!tokenData.config.chainId || tokenData.config.chainId <= 0) {
      throw new InvalidInputError(`Invalid ${fieldName} chainId`, {
        chainId: tokenData.config?.chainId,
      })
    }
  }

  private getWarpRoute(chainId: number, token: Hex): WarpRouteResult {
    const config = this.ecoConfigService.getWarpRoutes()

    const isToken = (chain: { chainId: number; token: Hex }) =>
      chain.chainId === chainId && isAddressEqual(chain.token, token)

    for (const route of config.routes) {
      const warpToken = route.chains.find(isToken)
      if (warpToken) {
        return { warpRoute: route, warpToken }
      }
    }

    return { warpRoute: undefined, warpToken: undefined }
  }

  private getAllWarpRoutes(chainId: number, token: Hex): WarpRouteResult[] {
    const config = this.ecoConfigService.getWarpRoutes()
    const results: WarpRouteResult[] = []

    const isToken = (chain: { chainId: number; token: Hex }) =>
      chain.chainId === chainId && isAddressEqual(chain.token, token)

    for (const route of config.routes) {
      const warpToken = route.chains.find(isToken)
      if (warpToken) {
        results.push({ warpRoute: route, warpToken })
      }
    }

    return results
  }

  private determineWarpRoutes(
    warpRoutesIn: WarpRouteResult[],
    warpRoutesOut: WarpRouteResult[],
  ): {
    warpRouteIn: WarpRouteResult | undefined
    warpRouteOut: WarpRouteResult | undefined
    actionPath: ActionPath
  } {
    // Case 1: Both tokens are NOT in any warp route
    if (warpRoutesIn.length === 0 && warpRoutesOut.length === 0) {
      this.logger.debug('WarpRoute: determineWarpRoutes -> UNSUPPORTED (no warp routes)')
      return {
        warpRouteIn: undefined,
        warpRouteOut: undefined,
        actionPath: ActionPath.UNSUPPORTED,
      }
    }

    // Case 2: One token is in a warp route, the other is not -> PARTIAL
    if (warpRoutesIn.length === 0 || warpRoutesOut.length === 0) {
      this.logger.debug('WarpRoute: determineWarpRoutes -> PARTIAL')
      return {
        warpRouteIn: warpRoutesIn[0],
        warpRouteOut: warpRoutesOut[0],
        actionPath: ActionPath.PARTIAL,
      }
    }

    // Case 3: Both tokens are in warp routes
    // Find if there's a common warp route
    let commonRouteIn: WarpRouteResult | undefined
    let commonRouteOut: WarpRouteResult | undefined

    for (const routeIn of warpRoutesIn) {
      for (const routeOut of warpRoutesOut) {
        if (routeIn.warpRoute === routeOut.warpRoute) {
          commonRouteIn = routeIn
          commonRouteOut = routeOut
          break
        }
      }
      if (commonRouteIn) break
    }

    // If no common route found, it's unsupported
    if (!commonRouteIn || !commonRouteOut) {
      this.logger.debug('WarpRoute: determineWarpRoutes -> UNSUPPORTED (different warp routes)')
      return {
        warpRouteIn: warpRoutesIn[0], // Return first found for error context
        warpRouteOut: warpRoutesOut[0],
        actionPath: ActionPath.UNSUPPORTED,
      }
    }

    // Same warp route found - check if it's a valid path
    const { warpToken: warpTokenIn } = commonRouteIn
    const { warpToken: warpTokenOut } = commonRouteOut

    // Collateral to collateral is not supported
    if (warpTokenIn?.type === 'collateral' && warpTokenOut?.type === 'collateral') {
      this.logger.debug('WarpRoute: determineWarpRoutes -> UNSUPPORTED (collateral to collateral)')
      return {
        warpRouteIn: commonRouteIn,
        warpRouteOut: commonRouteOut,
        actionPath: ActionPath.UNSUPPORTED,
      }
    }

    // All other cases in the same warp route are FULL
    this.logger.debug('WarpRoute: determineWarpRoutes -> FULL')
    return {
      warpRouteIn: commonRouteIn,
      warpRouteOut: commonRouteOut,
      actionPath: ActionPath.FULL,
    }
  }

  private async getPartialQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmountBased: bigint,
    warpRouteIn: WarpRouteResult | undefined,
    warpRouteOut: WarpRouteResult | undefined,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `WarpRoute: getting partial quote. From ${tokenIn.config.address} on ${tokenIn.config.chainId} to ${tokenOut.config.address} on ${tokenOut.config.chainId}`,
        id,
      }),
    )

    const { warpRoute: routeIn, warpToken: warpTokenIn } = warpRouteIn || {}
    const { warpRoute: routeOut, warpToken: warpTokenOut } = warpRouteOut || {}

    const client = await this.kernelAccountClientService.getClient(tokenIn.config.chainId)

    // Case 1: The input token is a synthetic token.
    // The only path is to warp it to its collateral and then swap to the destination.
    // Path: Synthetic -> Collateral -> TokenOut
    if (warpTokenIn?.type === 'synthetic') {
      return this.handleSyntheticToTokenPath(
        tokenIn,
        tokenOut,
        routeIn!,
        swapAmountBased,
        client,
        id,
      )
    }

    // Case 2: The input token is a collateral token.
    // We can warp it to a synthetic token and then swap to the destination.
    // Path: Collateral -> Synthetic -> TokenOut
    if (warpTokenIn?.type === 'collateral') {
      return this.handleCollateralToTokenPath(
        tokenIn,
        tokenOut,
        routeIn!,
        swapAmountBased,
        client,
        id,
      )
    }

    // Case 3: The output token is a synthetic token.
    // This means the only entry point is via its collateral.
    // Path: TokenIn -> Collateral -> Synthetic
    if (warpTokenOut?.type === 'synthetic') {
      return this.handleTokenToSyntheticPath(
        tokenIn,
        tokenOut,
        routeOut!,
        swapAmountBased,
        client,
        id,
      )
    }

    // Case 4: The output token is a collateral token.
    // The only entry point is via its synthetic counterparts.
    // Path: TokenIn -> Synthetic -> Collateral
    if (warpTokenOut?.type === 'collateral') {
      return this.handleTokenToCollateralPath(
        tokenIn,
        tokenOut,
        routeOut!,
        swapAmountBased,
        client,
        id,
      )
    }

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'WarpRoute: no partial quote path found.',
        id,
      }),
    )
    throw new PartialQuoteError('No partial quote path found', {
      tokenIn: tokenIn.config,
      tokenOut: tokenOut.config,
    })
  }

  private getTokenConfig(token: { chainId: number; token: Hex }): TokenConfig {
    return {
      type: 'erc20',
      address: token.token,
      chainId: token.chainId,
      targetBalance: 0n,
      minBalance: 0n,
    }
  }

  private async getBestLiFiQuote(
    tokenIn: TokenData,
    candidateTokens: WarpToken[],
    swapAmountBased: bigint,
    client: any,
    id?: string,
  ): Promise<{ tokenData: TokenData; quote: any; outputAmount: bigint } | null> {
    let bestResult: { tokenData: TokenData; quote: any; outputAmount: bigint } | null = null
    let bestAmountOut = 0n

    for (const candidateToken of candidateTokens) {
      this.logger.debug(
        EcoLogMessage.withId({
          message: `WarpRoute: Trying LiFi quote to ${candidateToken.token} on ${candidateToken.chainId}`,
          id,
        }),
      )

      try {
        const tokenConfig = this.getTokenConfig({
          chainId: candidateToken.chainId,
          token: candidateToken.token,
        })
        const tokenOut: TokenData = {
          chainId: candidateToken.chainId,
          config: tokenConfig,
          balance: {
            address: candidateToken.token,
            decimals: { original: 18, current: 18 }, // Placeholder. This is not used for LiFi quotes.
            balance: 0n, // Placeholder. This is not used for LiFi quotes.
          },
        }

        const liFiQuote = await this.liFiProviderService.getQuote(
          tokenIn,
          tokenOut,
          swapAmountBased,
          id,
        )

        const outputAmount = BigInt(liFiQuote.context.toAmountMin)
        if (outputAmount > bestAmountOut) {
          bestResult = { tokenData: tokenOut, quote: liFiQuote, outputAmount }
          bestAmountOut = outputAmount
          this.logger.debug(
            EcoLogMessage.withId({
              message: `WarpRoute: New best quote found with output ${outputAmount}`,
              id,
            }),
          )
        }
      } catch (error: any) {
        this.logger.debug(
          EcoLogMessage.withId({
            message: `WarpRoute: No LiFi quote to ${candidateToken.token}. Error: ${error.message}`,
            id,
          }),
        )
      }
    }

    return bestResult
  }

  private getMessageFromReceipt(receipt: TransactionReceipt) {
    const [dispatchIdLog] = parseEventLogs({
      abi: HyperlaneMailboxAbi,
      logs: receipt.logs,
      strict: true,
      eventName: 'DispatchId',
    })

    if (!dispatchIdLog) {
      throw new MessageDispatchError(receipt.transactionHash)
    }

    return dispatchIdLog.args
  }

  private async waitMessageRelay(chainId: number, messageId: Hex) {
    const client = await this.kernelAccountClientService.getClient(chainId)
    const { mailbox } = Hyperlane.getChainMetadata(this.ecoConfigService.getHyperlane(), chainId)
    if (!isAddress(mailbox)) {
      throw new WarpRouteError('Invalid mailbox address', { chainId, mailbox })
    }

    const MESSAGE_RELAY_TIMEOUT = 5 * 60 * 1000 // 5 minutes

    return withTimeout(
      new Promise((resolve, reject) => {
        client.watchEvent({
          address: mailbox,
          strict: true,
          event: getAbiItem({ abi: HyperlaneMailboxAbi, name: 'ProcessId' }),
          args: { messageId },
          onLogs: resolve,
          onError: reject,
        })
      }),
      MESSAGE_RELAY_TIMEOUT,
      `Message relay timeout after ${MESSAGE_RELAY_TIMEOUT}ms for messageId: ${messageId}`,
    )
  }

  private async handleSyntheticToTokenPath(
    tokenIn: TokenData,
    tokenOut: TokenData,
    warpRoute: WarpRoute,
    swapAmountBased: bigint,
    client: any,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `WarpRoute: trying path ${PARTIAL_QUOTE_PATHS.SYNTHETIC_TO_COLLATERAL}`,
        id,
      }),
    )

    const collateralChain = warpRoute.chains.find((c) => c.type === 'collateral')
    if (!collateralChain) {
      throw new PartialQuoteError('No collateral found for input synthetic token', {
        warpRoute,
        tokenType: 'synthetic',
      })
    }

    const collateralTokenConfig = this.getTokenConfig({
      chainId: collateralChain.chainId,
      token: collateralChain.token,
    })
    const [collateralTokenData] = await this.balanceService.getAllTokenDataForAddress(
      client.kernelAccountAddress,
      [collateralTokenConfig],
    )

    const remoteTransferQuote = this.getRemoteTransferQuote(
      tokenIn,
      collateralTokenData,
      swapAmountBased,
      id,
    )

    // Simulate balance after remote transfer so subsequent LiFi quote has the right context
    collateralTokenData.balance.balance += swapAmountBased
    const liFiQuote = await this.liFiProviderService.getQuote(
      collateralTokenData,
      tokenOut,
      swapAmountBased,
      id,
    )
    return [remoteTransferQuote, liFiQuote]
  }

  private async handleCollateralToTokenPath(
    tokenIn: TokenData,
    tokenOut: TokenData,
    warpRoute: WarpRoute,
    swapAmountBased: bigint,
    client: any,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `WarpRoute: trying path ${PARTIAL_QUOTE_PATHS.COLLATERAL_TO_SYNTHETIC}`,
        id,
      }),
    )

    const syntheticChains = warpRoute.chains.filter((c) => c.type === 'synthetic')
    if (!syntheticChains || syntheticChains.length === 0) {
      throw new PartialQuoteError('No synthetic chains found for input collateral token', {
        warpRoute,
        tokenType: 'collateral',
      })
    }

    for (const syntheticChain of syntheticChains) {
      this.logger.debug(
        EcoLogMessage.withId({
          message: `WarpRoute: C->S->T: trying intermediate ${syntheticChain.token} on ${syntheticChain.chainId}`,
          id,
        }),
      )
      const intermediateTokenConfig = this.getTokenConfig({
        chainId: syntheticChain.chainId,
        token: syntheticChain.token,
      })
      const [intermediateTokenData] = await this.balanceService.getAllTokenDataForAddress(
        client.kernelAccountAddress,
        [intermediateTokenConfig],
      )

      try {
        // Simulate the balance on the intermediate token to get a more accurate quote
        const simulatedIntermediateData = { ...intermediateTokenData }
        simulatedIntermediateData.balance.balance += swapAmountBased
        const liFiQuote = await this.liFiProviderService.getQuote(
          simulatedIntermediateData,
          tokenOut,
          swapAmountBased,
        )

        const remoteTransferQuote = this.getRemoteTransferQuote(
          tokenIn,
          intermediateTokenData,
          swapAmountBased,
          id,
        )
        return [remoteTransferQuote, liFiQuote]
      } catch (error: any) {
        this.logger.debug(
          EcoLogMessage.withId({
            message: `WarpRoute: No LiFi quote from intermediate ${syntheticChain.token} to ${tokenOut.config.address}. Error: ${error.message}`,
            id,
          }),
        )
      }
    }

    throw new PartialQuoteError('No valid synthetic chain found for collateral to token path', {
      warpRoute,
      tokenIn: tokenIn.config,
      tokenOut: tokenOut.config,
    })
  }

  private async handleTokenToSyntheticPath(
    tokenIn: TokenData,
    tokenOut: TokenData,
    warpRoute: WarpRoute,
    swapAmountBased: bigint,
    client: any,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `WarpRoute: trying path ${PARTIAL_QUOTE_PATHS.TOKEN_TO_SYNTHETIC}`,
        id,
      }),
    )

    const collateralChains = warpRoute.chains.filter((c) => c.type === 'collateral')
    if (!collateralChains || collateralChains.length === 0) {
      throw new PartialQuoteError('No collateral found for output synthetic token', {
        warpRoute,
        tokenType: 'synthetic',
      })
    }

    const bestLiFiResult = await this.getBestLiFiQuote(
      tokenIn,
      collateralChains,
      swapAmountBased,
      client,
      id,
    )

    if (!bestLiFiResult) {
      throw new PartialQuoteError('No valid collateral chain found for token to synthetic path', {
        warpRoute,
        tokenIn: tokenIn.config,
        tokenOut: tokenOut.config,
      })
    }

    const remoteTransferQuote = this.getRemoteTransferQuote(
      bestLiFiResult.tokenData,
      tokenOut,
      bestLiFiResult.outputAmount,
      id,
    )

    return [bestLiFiResult.quote, remoteTransferQuote]
  }

  private async handleTokenToCollateralPath(
    tokenIn: TokenData,
    tokenOut: TokenData,
    warpRoute: WarpRoute,
    swapAmountBased: bigint,
    client: any,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `WarpRoute: trying path ${PARTIAL_QUOTE_PATHS.TOKEN_TO_COLLATERAL}`,
        id,
      }),
    )

    const syntheticChains = warpRoute.chains.filter((c) => c.type === 'synthetic')
    if (!syntheticChains || syntheticChains.length === 0) {
      throw new PartialQuoteError('No synthetic chains found for output collateral token', {
        warpRoute,
        tokenType: 'collateral',
      })
    }

    const bestLiFiResult = await this.getBestLiFiQuote(
      tokenIn,
      syntheticChains,
      swapAmountBased,
      client,
      id,
    )

    if (!bestLiFiResult) {
      throw new PartialQuoteError('No valid synthetic chain found for token to collateral path', {
        warpRoute,
        tokenIn: tokenIn.config,
        tokenOut: tokenOut.config,
      })
    }

    const remoteTransferQuote = this.getRemoteTransferQuote(
      bestLiFiResult.tokenData,
      tokenOut,
      bestLiFiResult.outputAmount,
      id,
    )

    return [bestLiFiResult.quote, remoteTransferQuote]
  }
}
