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

enum ActionPath {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
  UNSUPPORTED = 'UNSUPPORTED',
}

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

    const actionPath = this.getActionPath(tokenIn.config, tokenOut.config)

    if (actionPath === ActionPath.UNSUPPORTED) throw new Error('Unsupported action path')

    if (actionPath === ActionPath.PARTIAL) {
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'WarpRouteProviderService: getting partial quote',
          id,
          properties: { tokenIn, tokenOut, swapAmount },
        }),
      )
      const quotes = await this.getPartialQuote(tokenIn, tokenOut, swapAmount, id)
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
    const txHash = await this._execute(walletAddress, quote)
    const receipt = await client.waitForTransactionReceipt({ hash: txHash })

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
    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

    if (isAddressEqual(client.kernelAccountAddress, walletAddress as Hex)) {
      return this.executeWithKernel(walletAddress, quote)
    }

    throw new Error('Unsupported wallet')
  }

  private async executeWithKernel(walletAddress: string, quote: RebalanceQuote<'WarpRoute'>) {
    const transactions = await this.executeRemoteTransfer(
      quote.tokenIn.config,
      quote.tokenOut.config.chainId,
      walletAddress as Hex,
      quote.amountOut,
    )

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

    // Make sure the Kernel wallet is used
    if (!isAddressEqual(client.kernelAccountAddress, walletAddress as Hex)) {
      throw new Error('Unexpected wallet during WarpRoute execution')
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

    if (!warpToken)
      throw new Error(`Warp route not found for ${tokenIn.address} in chain ${tokenIn.chainId}`)

    // Transfer remote transaction
    const transferRemoteFee = await client.readContract({
      address: warpToken.warpContract,
      abi: hyperlaneCollateralERC20,
      functionName: 'quoteGasPayment',
      args: [destinationChainId],
    })

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
    if (warpToken.type === 'collateral') {
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

  private getWarpRoute(chainId: number, token: Hex) {
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

  private getActionPath(tokenIn: TokenConfig, tokenOut: TokenConfig) {
    const { warpRoute: warpRouteIn, warpToken: warpTokenIn } = this.getWarpRoute(
      tokenIn.chainId,
      tokenIn.address,
    )
    const { warpRoute: warpRouteOut, warpToken: warpTokenOut } = this.getWarpRoute(
      tokenOut.chainId,
      tokenOut.address,
    )

    if (!warpRouteIn || !warpRouteOut) {
      this.logger.debug('WarpRoute: getActionPath -> UNSUPPORTED')
      return ActionPath.UNSUPPORTED
    }

    if (warpRouteIn === warpRouteOut && warpTokenIn?.type !== warpTokenOut?.type) {
      this.logger.debug('WarpRoute: getActionPath -> FULL')
      return ActionPath.FULL
    }

    this.logger.debug('WarpRoute: getActionPath -> PARTIAL')
    return ActionPath.PARTIAL
  }

  private async getPartialQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    id?: string,
  ): Promise<RebalanceQuote[]> {
    this.logger.debug(
      EcoLogMessage.withId({
        message: `WarpRoute: getting partial quote. From ${tokenIn.config.address} on ${tokenIn.config.chainId} to ${tokenOut.config.address} on ${tokenOut.config.chainId}`,
        id,
      }),
    )

    const { warpRoute: warpRouteIn, warpToken: warpTokenIn } = this.getWarpRoute(
      tokenIn.config.chainId,
      tokenIn.config.address,
    )
    const { warpRoute: warpRouteOut, warpToken: warpTokenOut } = this.getWarpRoute(
      tokenOut.config.chainId,
      tokenOut.config.address,
    )

    const amount = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)
    const client = await this.kernelAccountClientService.getClient(tokenIn.config.chainId)

    // Case 1: The input token is a synthetic token.
    // The only path is to warp it to its collateral and then swap to the destination.
    // Path: Synthetic -> Collateral -> TokenOut
    if (warpTokenIn?.type === 'synthetic') {
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'WarpRoute: trying path Synthetic -> Collateral -> TokenOut',
          id,
        }),
      )
      const collateralChain = warpRouteIn?.chains.find((c) => c.type === 'collateral')
      if (!collateralChain)
        throw new Error('No collateral found for input synthetic token in partial quote')

      const collateralTokenConfig = this.getTokenConfig({
        chainId: collateralChain.chainId,
        token: collateralChain.token,
      })
      const [collateralTokenData] = await this.balanceService.getAllTokenDataForAddress(
        client.kernelAccountAddress,
        [collateralTokenConfig],
      )

      const remoteTransferQuote = this.getRemoteTransferQuote(tokenIn, collateralTokenData, amount)

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

    // Case 2: The input token is a collateral token.
    // We can warp it to a synthetic token and then swap to the destination.
    // Path: Collateral -> Synthetic -> TokenOut
    if (warpTokenIn?.type === 'collateral') {
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'WarpRoute: trying path Collateral -> Synthetic -> TokenOut',
          id,
        }),
      )
      const syntheticChains = warpRouteIn?.chains.filter((c) => c.type === 'synthetic')
      if (!syntheticChains) throw new Error('No synthetic chains found for input collateral token')

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
        } catch (error) {
          this.logger.debug(
            EcoLogMessage.withId({
              message: `WarpRoute: No LiFi quote from intermediate ${syntheticChain.token} to ${tokenOut.config.address}. Error: ${error.message}`,
              id,
            }),
          )
        }
      }
    }

    // Case 3: The output token is a synthetic token.
    // This means the only entry point is via its collateral.
    // Path: TokenIn -> Collateral -> Synthetic
    if (warpTokenOut?.type === 'synthetic') {
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'WarpRoute: trying path TokenIn -> Collateral -> Synthetic',
          id,
        }),
      )
      const collateralChain = warpRouteOut?.chains.find((c) => c.type === 'collateral')
      if (!collateralChain)
        throw new Error('No collateral found for output synthetic token in partial quote')

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

    // Case 4: The output token is a collateral token.
    // The only entry point is via its synthetic counterparts.
    // Path: TokenIn -> Synthetic -> Collateral
    if (warpTokenOut?.type === 'collateral') {
      this.logger.debug(
        EcoLogMessage.withId({
          message: 'WarpRoute: trying path TokenIn -> Synthetic -> Collateral',
          id,
        }),
      )
      const syntheticChains = warpRouteOut?.chains.filter((c) => c.type === 'synthetic')
      if (!syntheticChains) throw new Error('No synthetic chains found for output collateral token')

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
        } catch (error) {
          this.logger.debug(
            EcoLogMessage.withId({
              message: `WarpRoute: No LiFi quote from ${tokenIn.config.address} to intermediate ${syntheticChain.token}. Error: ${error.message}`,
              id,
            }),
          )
        }
      }
    }

    this.logger.debug(
      EcoLogMessage.withId({
        message: 'WarpRoute: no partial quote path found.',
        id,
      }),
    )
    throw new Error('Unable to get quote for partial action path')
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
      throw new Error('No message dispatched in transaction')
    }

    return dispatchIdLog.args
  }

  private async waitMessageRelay(chainId: number, messageId: Hex) {
    const client = await this.kernelAccountClientService.getClient(chainId)
    const { mailbox } = Hyperlane.getChainMetadata(this.ecoConfigService.getHyperlane(), chainId)

    return new Promise((resolve, reject) => {
      client.watchEvent({
        address: mailbox as Hex,
        strict: true,
        event: getAbiItem({ abi: HyperlaneMailboxAbi, name: 'ProcessId' }),
        args: { messageId },
        onLogs: resolve,
        onError: reject,
      })
    })
  }
}
