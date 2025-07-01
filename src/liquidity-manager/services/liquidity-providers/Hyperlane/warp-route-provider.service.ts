import { Injectable, Logger } from '@nestjs/common'
import {
  encodeFunctionData,
  erc20Abi,
  getAbiItem,
  Hex,
  isAddressEqual,
  pad,
  parseEventLogs,
  parseUnits,
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
import { ActionPath, WarpRoute, WarpRouteResult, PARTIAL_QUOTE_PATHS } from './warp-route.types'
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

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    // Validate inputs
    this.validateTokenData(tokenIn, 'tokenIn')
    this.validateTokenData(tokenOut, 'tokenOut')
    if (swapAmount <= 0) {
      throw new InvalidInputError('Swap amount must be positive', { swapAmount })
    }
    this.logger.debug(
      EcoLogMessage.withId({
        message: 'WarpRouteProviderService: getting quote',
        id,
        properties: {
          tokenIn,
          tokenOut,
          swapAmount,
        },
      }),
    )

    // Get warp route information for both tokens
    const warpRouteIn = this.getWarpRoute(tokenIn.config.chainId, tokenIn.config.address)
    const warpRouteOut = this.getWarpRoute(tokenOut.config.chainId, tokenOut.config.address)

    const actionPath = this.getActionPath(warpRouteIn, warpRouteOut)

    if (actionPath === ActionPath.UNSUPPORTED) {
      throw new UnsupportedActionPathError(tokenIn.config, tokenOut.config)
    }

    if (actionPath === ActionPath.PARTIAL) {
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'WarpRouteProviderService: getting partial quote',
          id,
          properties: { tokenIn, tokenOut, swapAmount },
        }),
      )
      const quotes = await this.getPartialQuote(
        tokenIn,
        tokenOut,
        swapAmount,
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

    const amount = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)

    const quote = this.getRemoteTransferQuote(tokenIn, tokenOut, amount)

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
    amount: bigint,
    id?: string,
  ): RebalanceQuote<'WarpRoute'> {
    return {
      amountIn: amount,
      amountOut: amount,
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

  private getActionPath(warpRouteIn: WarpRouteResult, warpRouteOut: WarpRouteResult) {
    const { warpRoute: routeIn, warpToken: warpTokenIn } = warpRouteIn
    const { warpRoute: routeOut, warpToken: warpTokenOut } = warpRouteOut

    // Case 1: Both tokens are NOT in any warp route
    if (!routeIn && !routeOut) {
      this.logger.debug('WarpRoute: getActionPath -> UNSUPPORTED (no warp routes)')
      return ActionPath.UNSUPPORTED
    }

    // Case 2: One token is in a warp route, the other is not -> PARTIAL
    if (!routeIn || !routeOut) {
      this.logger.debug('WarpRoute: getActionPath -> PARTIAL')
      return ActionPath.PARTIAL
    }

    // Case 3: Both tokens are in warp routes
    // For synthetic tokens: different warp routes are not supported (synthetics are unique to one route)
    // For collateral tokens: they might be in different routes, which is also not supported
    if (routeIn !== routeOut) {
      // Special case: if both are collateral tokens, they might share the same address but be in different routes
      // This is still unsupported
      this.logger.debug('WarpRoute: getActionPath -> UNSUPPORTED (different warp routes)')
      return ActionPath.UNSUPPORTED
    }

    // Same warp route cases:
    // Collateral to collateral is not supported
    if (warpTokenIn?.type === 'collateral' && warpTokenOut?.type === 'collateral') {
      this.logger.debug('WarpRoute: getActionPath -> UNSUPPORTED (collateral to collateral)')
      return ActionPath.UNSUPPORTED
    }

    // All other cases in the same warp route are FULL:
    // - collateral to synthetic
    // - synthetic to collateral
    // - synthetic to synthetic (different chains)
    this.logger.debug('WarpRoute: getActionPath -> FULL')
    return ActionPath.FULL
  }

  private async getPartialQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    warpRouteIn: WarpRouteResult,
    warpRouteOut: WarpRouteResult,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `WarpRoute: getting partial quote. From ${tokenIn.config.address} on ${tokenIn.config.chainId} to ${tokenOut.config.address} on ${tokenOut.config.chainId}`,
        id,
      }),
    )

    const { warpRoute: routeIn, warpToken: warpTokenIn } = warpRouteIn
    const { warpRoute: routeOut, warpToken: warpTokenOut } = warpRouteOut

    const amount = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)
    const client = await this.kernelAccountClientService.getClient(tokenIn.config.chainId)

    // Case 1: The input token is a synthetic token.
    // The only path is to warp it to its collateral and then swap to the destination.
    // Path: Synthetic -> Collateral -> TokenOut
    if (warpTokenIn?.type === 'synthetic') {
      return this.handleSyntheticToTokenPath(
        tokenIn,
        tokenOut,
        routeIn!,
        amount,
        swapAmount,
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
        amount,
        swapAmount,
        client,
        id,
      )
    }

    // Case 3: The output token is a synthetic token.
    // This means the only entry point is via its collateral.
    // Path: TokenIn -> Collateral -> Synthetic
    if (warpTokenOut?.type === 'synthetic') {
      return this.handleTokenToSyntheticPath(tokenIn, tokenOut, routeOut!, swapAmount, client, id)
    }

    // Case 4: The output token is a collateral token.
    // The only entry point is via its synthetic counterparts.
    // Path: TokenIn -> Synthetic -> Collateral
    if (warpTokenOut?.type === 'collateral') {
      return this.handleTokenToCollateralPath(tokenIn, tokenOut, routeOut!, swapAmount, client, id)
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
      targetBalance: 0,
      minBalance: 0,
    }
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
    amount: bigint,
    swapAmount: number,
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

    const remoteTransferQuote = this.getRemoteTransferQuote(tokenIn, collateralTokenData, amount)

    // Check if tokenOut is the collateral token - if so, we only need the remote transfer
    if (
      collateralChain.chainId === tokenOut.config.chainId &&
      isAddressEqual(collateralChain.token, tokenOut.config.address)
    ) {
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'WarpRoute: tokenOut is the collateral token, only remote transfer needed',
          id,
        }),
      )
      return [remoteTransferQuote]
    }

    // Simulate balance after remote transfer so subsequent LiFi quote has the right context
    collateralTokenData.balance.balance += amount
    const liFiQuote = await this.liFiProviderService.getQuote(
      collateralTokenData,
      tokenOut,
      swapAmount,
      id,
    )
    return [remoteTransferQuote, liFiQuote]
  }

  private async handleCollateralToTokenPath(
    tokenIn: TokenData,
    tokenOut: TokenData,
    warpRoute: WarpRoute,
    amount: bigint,
    swapAmount: number,
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

      // Check if tokenOut is this synthetic token
      if (
        syntheticChain.chainId === tokenOut.config.chainId &&
        isAddressEqual(syntheticChain.token, tokenOut.config.address)
      ) {
        this.logger.debug(
          EcoLogMessage.withId({
            message: 'WarpRoute: tokenOut is the synthetic token, only remote transfer needed',
            id,
          }),
        )
        const remoteTransferQuote = this.getRemoteTransferQuote(
          tokenIn,
          intermediateTokenData,
          amount,
        )
        return [remoteTransferQuote]
      }

      try {
        // Simulate the balance on the intermediate token to get a more accurate quote
        const simulatedIntermediateData = { ...intermediateTokenData }
        simulatedIntermediateData.balance.balance += amount
        const liFiQuote = await this.liFiProviderService.getQuote(
          simulatedIntermediateData,
          tokenOut,
          swapAmount,
        )

        const remoteTransferQuote = this.getRemoteTransferQuote(
          tokenIn,
          intermediateTokenData,
          amount,
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
    swapAmount: number,
    client: any,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `WarpRoute: trying path ${PARTIAL_QUOTE_PATHS.TOKEN_TO_SYNTHETIC}`,
        id,
      }),
    )

    const collateralChain = warpRoute.chains.find((c) => c.type === 'collateral')
    if (!collateralChain) {
      throw new PartialQuoteError('No collateral found for output synthetic token', {
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

    const liFiQuote = await this.liFiProviderService.getQuote(
      tokenIn,
      collateralTokenData,
      swapAmount,
      id,
    )
    const remoteTransferQuote = this.getRemoteTransferQuote(
      collateralTokenData,
      tokenOut,
      BigInt(liFiQuote.context.toAmountMin),
    )
    return [liFiQuote, remoteTransferQuote]
  }

  private async handleTokenToCollateralPath(
    tokenIn: TokenData,
    tokenOut: TokenData,
    warpRoute: WarpRoute,
    swapAmount: number,
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

    for (const syntheticChain of syntheticChains) {
      this.logger.debug(
        EcoLogMessage.withId({
          message: `WarpRoute: T->S->C: trying intermediate ${syntheticChain.token} on ${syntheticChain.chainId}`,
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
        const liFiQuote = await this.liFiProviderService.getQuote(
          tokenIn,
          intermediateTokenData,
          swapAmount,
        )
        const remoteTransferQuote = this.getRemoteTransferQuote(
          intermediateTokenData,
          tokenOut,
          BigInt(liFiQuote.context.toAmountMin),
        )
        return [liFiQuote, remoteTransferQuote]
      } catch (error: any) {
        this.logger.debug(
          EcoLogMessage.withId({
            message: `WarpRoute: No LiFi quote from ${tokenIn.config.address} to intermediate ${syntheticChain.token}. Error: ${error.message}`,
            id,
          }),
        )
      }
    }

    throw new PartialQuoteError('No valid synthetic chain found for token to collateral path', {
      warpRoute,
      tokenIn: tokenIn.config,
      tokenOut: tokenOut.config,
    })
  }
}
