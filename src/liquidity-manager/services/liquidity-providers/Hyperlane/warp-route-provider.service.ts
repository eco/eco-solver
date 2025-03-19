import { Injectable, Logger } from '@nestjs/common'
import {
  encodeFunctionData,
  erc20Abi,
  Hex,
  isAddressEqual,
  pad,
  parseUnits,
  TransactionRequest,
} from 'viem'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { WarpRouteConfig } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { TokenConfig } from '@/balance/types'
import { BalanceService } from '@/balance/balance.service'
import { hyperlaneCollateralERC20 } from '@/contracts/HyperlaneCollateralERC20'
import { RebalanceQuote, TokenData } from '@/liquidity-manager/types/types'
import { IRebalanceProvider } from '@/liquidity-manager/interfaces/IRebalanceProvider'
import { LiFiProviderService } from '@/liquidity-manager/services/liquidity-providers/LiFi/lifi-provider.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'

enum ActionPath {
  FULL = 'FULL',
  PARTIAL = 'PARTIAL',
  UNSUPPORTED = 'UNSUPPORTED',
}

@Injectable()
export class WarpRouteProviderService implements IRebalanceProvider<'WarpRoute'> {
  private logger = new Logger(WarpRouteProviderService.name)

  private config: WarpRouteConfig

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly liFiProviderService: LiFiProviderService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {
    this.config = this.ecoConfigService.getWarpRoute()
  }

  getStrategy() {
    return 'WarpRoute' as const
  }

  async getQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote[]> {
    const actionPath = this.getActionPath(tokenIn.config, tokenOut.config)

    if (actionPath === ActionPath.UNSUPPORTED) throw new Error('Unsupported action path')

    if (actionPath === ActionPath.PARTIAL) {
      return this.getPartialQuote(tokenIn, tokenOut, swapAmount)
    }

    const amount = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)
    return [this.getRemoteTransferQuote(tokenIn, tokenOut, amount)]
  }

  async execute(walletAddress: string, quote: RebalanceQuote<'WarpRoute'>) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: 'WarpRouteProviderService: executing quote',
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
    return client.waitForTransactionReceipt({ hash: txHash })
  }

  private getRemoteTransferQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    amount: bigint,
  ): RebalanceQuote<'WarpRoute'> {
    return {
      amountIn: amount,
      amountOut: amount,
      slippage: 0,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      strategy: this.getStrategy(),
      context: undefined,
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
      quote.tokenIn.config.address,
      quote.tokenIn.config.chainId,
      quote.tokenOut.config.chainId,
      walletAddress as Hex,
      quote.amountOut,
    )

    const client = await this.kernelAccountClientService.getClient(quote.tokenIn.chainId)

    // Make sure the Kernel wallet is used
    if (walletAddress !== client.account?.address) {
      throw new Error('Unexpected wallet during WarpRoute execution')
    }

    return client.execute(
      transactions.map((tx) => ({ to: tx.to!, data: tx.data ?? '0x', value: tx.value })),
    )
  }

  private async executeRemoteTransfer(
    tokenIn: Hex,
    sourceChainId: number,
    destinationChainId: number,
    recipient: Hex,
    amount: bigint,
  ): Promise<TransactionRequest[]> {
    const client = await this.kernelAccountClientService.getClient(sourceChainId)
    const { warpToken } = this.getWarpRoute(sourceChainId, tokenIn)

    if (!warpToken) throw new Error(`Warp route not found for ${tokenIn} in chain ${sourceChainId}`)

    // Transfer remote transaction

    const transferRemoteFee = await client.readContract({
      address: warpToken.synthetic,
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
      to: warpToken.synthetic,
      value: transferRemoteFee,
      data: transferRemoteData,
    }

    // Approval
    // If Warp route synthetic token is different to the WarpRoute contract, and approval is needed
    if (!isAddressEqual(warpToken.synthetic, tokenIn)) {
      const approvalData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [warpToken.synthetic, amount],
      })

      const approvalTx: TransactionRequest = {
        to: warpToken.token,
        data: approvalData,
      }

      return [approvalTx, transferRemoteTx]
    }

    // Only return remote transfer transaction
    return [transferRemoteTx]
  }

  private getWarpRoute(chainId: number, token: Hex) {
    const isToken = (route: { chainId: number; token: Hex }) =>
      route.chainId === chainId && isAddressEqual(route.token, token)

    const warpRoute = this.config.routes.find((warproutes) => {
      const isTokenRoute = warproutes.chains.some(isToken)
      const isCollateral = isToken(warproutes.collateral)

      return isTokenRoute || isCollateral
    })

    const warpToken = warpRoute?.chains.find(isToken)

    return { warpRoute, warpToken }
  }

  private getActionPath(tokenIn: TokenConfig, tokenOut: TokenConfig) {
    const warpTokenIn = this.getWarpRoute(tokenIn.chainId, tokenIn.address).warpRoute
    const warpTokenOut = this.getWarpRoute(tokenOut.chainId, tokenOut.address).warpRoute

    if (!warpTokenIn && !warpTokenOut) {
      return ActionPath.UNSUPPORTED
    }

    if (warpTokenIn && warpTokenOut && warpTokenIn === warpTokenOut) {
      return ActionPath.FULL
    }

    return ActionPath.PARTIAL
  }

  private async getPartialQuote(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
  ): Promise<RebalanceQuote[]> {
    // Case 1: Synthetic -> Collateral -> Token:

    const warpTokenIn = this.getWarpRoute(tokenIn.chainId, tokenIn.config.address)
    const warpTokenOut = this.getWarpRoute(tokenOut.chainId, tokenOut.config.address)

    const amount = parseUnits(swapAmount.toString(), tokenIn.balance.decimals)
    const client = await this.kernelAccountClientService.getClient(tokenIn.chainId)

    if (warpTokenIn.warpRoute) {
      const collateral = warpTokenIn.warpRoute.collateral
      const collateralTokenConfig = this.getTokenConfig(collateral)

      const [collateralTokenData] = await this.balanceService.getAllTokenDataForAddress(
        client.kernelAccountAddress,
        [collateralTokenConfig],
      )

      const remoteTransferQuote = this.getRemoteTransferQuote(tokenIn, collateralTokenData, amount)

      // Use balance after remote transfer
      collateralTokenData.balance.balance += amount

      const liFiQuote = await this.liFiProviderService.getQuote(
        collateralTokenData,
        tokenOut,
        swapAmount,
      )

      return [remoteTransferQuote, liFiQuote]
    } else if (warpTokenOut.warpRoute) {
      // Case 2: Token -> Collateral -> Synthetic:

      const collateral = warpTokenOut.warpRoute.collateral
      const collateralTokenConfig = this.getTokenConfig(collateral)

      const [collateralTokenData] = await this.balanceService.getAllTokenDataForAddress(
        client.kernelAccountAddress,
        [collateralTokenConfig],
      )

      const liFiQuote = await this.liFiProviderService.getQuote(
        tokenIn,
        collateralTokenData,
        swapAmount,
      )

      const remoteTransferQuote = this.getRemoteTransferQuote(
        tokenIn,
        collateralTokenData,
        BigInt(liFiQuote.context.toAmountMin),
      )

      return [remoteTransferQuote, liFiQuote]
    }

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
}
