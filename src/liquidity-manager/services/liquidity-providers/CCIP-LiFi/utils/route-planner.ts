import { TokenData } from '@/liquidity-manager/types/types'
import { isAddressEqual, Hex } from 'viem'

export interface RouteStep {
  type: 'sourceSwap' | 'ccipBridge' | 'destinationSwap'
  required: boolean
}

export interface BridgeTokenInfo {
  symbol: string
  sourceAddress: Hex
  destinationAddress: Hex
}

export interface PlannedRoute {
  steps: RouteStep[]
  bridgeToken: BridgeTokenInfo
}

/**
 * Bridge token configuration per chain
 * Maps chainId -> { symbol -> address }
 */
export type BridgeTokenConfig = Record<number, Record<string, Hex>>

export class CCIPLiFiRoutePlanner {
  private static bridgeTokens: BridgeTokenConfig = {}

  /**
   * Updates the bridge token addresses from config
   */
  static updateBridgeTokens(config: BridgeTokenConfig): void {
    CCIPLiFiRoutePlanner.bridgeTokens = { ...config }
  }

  /**
   * Gets current bridge token config
   */
  static getBridgeTokens(): BridgeTokenConfig {
    return { ...CCIPLiFiRoutePlanner.bridgeTokens }
  }

  /**
   * Plans the route steps needed for a CCIPLiFi operation
   */
  static planRoute(tokenIn: TokenData, tokenOut: TokenData): PlannedRoute {
    const bridgeToken = this.selectBridgeToken(tokenIn.chainId, tokenOut.chainId)

    const sourceIsBridgeToken = this.isBridgeTokenOnChain(tokenIn, bridgeToken.sourceAddress)
    const destinationIsBridgeToken = this.isBridgeTokenOnChain(
      tokenOut,
      bridgeToken.destinationAddress,
    )

    const steps: RouteStep[] = []

    if (!sourceIsBridgeToken) {
      steps.push({ type: 'sourceSwap', required: true })
    }

    steps.push({ type: 'ccipBridge', required: true })

    if (!destinationIsBridgeToken) {
      steps.push({ type: 'destinationSwap', required: true })
    }

    return { steps, bridgeToken }
  }

  /**
   * Selects the best bridge token for the given chain pair
   * Prefers USDC if available on both chains
   */
  static selectBridgeToken(sourceChainId: number, destinationChainId: number): BridgeTokenInfo {
    const sourceTokens = this.bridgeTokens[sourceChainId] || {}
    const destTokens = this.bridgeTokens[destinationChainId] || {}

    // Find common tokens
    const commonSymbols = Object.keys(sourceTokens).filter((sym) => destTokens[sym])

    if (commonSymbols.length === 0) {
      throw new Error(
        `CCIPLiFi: No common bridge token between chains ${sourceChainId} and ${destinationChainId}`,
      )
    }

    // Prefer USDC, then first available
    const symbol = commonSymbols.includes('USDC') ? 'USDC' : commonSymbols[0]

    return {
      symbol,
      sourceAddress: sourceTokens[symbol],
      destinationAddress: destTokens[symbol],
    }
  }

  /**
   * Validates that both chains support CCIP bridging
   */
  static validateCCIPSupport(sourceChainId: number, destinationChainId: number): boolean {
    const sourceTokens = this.bridgeTokens[sourceChainId]
    const destTokens = this.bridgeTokens[destinationChainId]

    if (!sourceTokens || !destTokens) {
      return false
    }

    // Check for at least one common token
    const commonSymbols = Object.keys(sourceTokens).filter((sym) => destTokens[sym])
    return commonSymbols.length > 0
  }

  private static isBridgeTokenOnChain(token: TokenData, bridgeTokenAddress: Hex): boolean {
    if (!bridgeTokenAddress) return false
    return isAddressEqual(token.config.address as Hex, bridgeTokenAddress)
  }
}
