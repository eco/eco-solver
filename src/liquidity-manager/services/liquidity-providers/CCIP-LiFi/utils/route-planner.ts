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

/**
 * Function type for validating if a CCIP route is available for a specific token
 */
export type CCIPRouteValidator = (
  sourceChainId: number,
  destChainId: number,
  tokenSymbol: string,
) => Promise<boolean>

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
   * Gets common bridge token symbols between two chains
   */
  static getCommonBridgeTokens(sourceChainId: number, destChainId: number): string[] {
    const sourceTokens = this.bridgeTokens[sourceChainId] || {}
    const destTokens = this.bridgeTokens[destChainId] || {}
    return Object.keys(sourceTokens).filter((sym) => destTokens[sym])
  }

  /**
   * Plans the route steps needed for a CCIPLiFi operation.
   * Requires a pre-validated bridge token (use selectBridgeTokenAsync first).
   */
  static planRoute(
    tokenIn: TokenData,
    tokenOut: TokenData,
    bridgeToken: BridgeTokenInfo,
  ): PlannedRoute {
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
   * Selects the best bridge token for the given chain pair using the provided validator.
   * The validator should check if a CCIP route is available (e.g., via CCIPProviderService).
   * Prefers USDC if available and has a valid CCIP lane.
   */
  static async selectBridgeTokenAsync(
    sourceChainId: number,
    destinationChainId: number,
    validator: CCIPRouteValidator,
  ): Promise<BridgeTokenInfo> {
    const sourceTokens = this.bridgeTokens[sourceChainId] || {}
    const destTokens = this.bridgeTokens[destinationChainId] || {}

    // Find common tokens
    const commonSymbols = Object.keys(sourceTokens).filter((sym) => destTokens[sym])

    if (commonSymbols.length === 0) {
      throw new Error(
        `CCIPLiFi: No common bridge token between chains ${sourceChainId} and ${destinationChainId}`,
      )
    }

    // Filter to only tokens with valid CCIP lanes (using the validator)
    const validSymbols: string[] = []
    for (const sym of commonSymbols) {
      const isValid = await validator(sourceChainId, destinationChainId, sym)
      if (isValid) {
        validSymbols.push(sym)
      }
    }

    if (validSymbols.length === 0) {
      throw new Error(
        `CCIPLiFi: No supported bridge token between chains ${sourceChainId} and ${destinationChainId}`,
      )
    }

    // Prefer USDC, then first available
    const symbol = validSymbols.includes('USDC') ? 'USDC' : validSymbols[0]

    return {
      symbol,
      sourceAddress: sourceTokens[symbol],
      destinationAddress: destTokens[symbol],
    }
  }

  /**
   * Validates that both chains support CCIP bridging with at least one common bridge token
   * that has a valid CCIP lane (checked via the provided validator).
   */
  static async validateCCIPSupportAsync(
    sourceChainId: number,
    destinationChainId: number,
    validator: CCIPRouteValidator,
  ): Promise<boolean> {
    const commonSymbols = this.getCommonBridgeTokens(sourceChainId, destinationChainId)

    if (commonSymbols.length === 0) {
      return false
    }

    // Check if at least one common token has a valid CCIP lane
    for (const sym of commonSymbols) {
      const isValid = await validator(sourceChainId, destinationChainId, sym)
      if (isValid) {
        return true
      }
    }

    return false
  }

  private static isBridgeTokenOnChain(token: TokenData, bridgeTokenAddress: Hex): boolean {
    if (!bridgeTokenAddress) return false
    return isAddressEqual(token.config.address as Hex, bridgeTokenAddress)
  }
}
