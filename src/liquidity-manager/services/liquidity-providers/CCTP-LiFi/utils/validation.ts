import { TokenData } from '@/liquidity-manager/types/types'
import { CCTPLiFiRoutePlanner } from './route-planner'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

export interface GasEstimation {
  sourceChainGas: bigint
  destinationChainGas: bigint
  totalGasUSD: number
  gasWarnings: string[]
}

export class CCTPLiFiValidator {
  /**
   * Validates a CCTPLiFi route before execution
   * @param tokenIn Source token
   * @param tokenOut Destination token
   * @param swapAmount Amount to swap
   * @param maxSlippage Maximum acceptable slippage (0-1)
   * @returns Validation result with errors if any
   */
  static validateRoute(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmountBased: bigint,
    maxSlippage: number,
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate CCTP support for both chains
    if (!CCTPLiFiRoutePlanner.validateCCTPSupport(tokenIn.chainId, tokenOut.chainId)) {
      errors.push(`CCTP not supported for route ${tokenIn.chainId} → ${tokenOut.chainId}`)
    }

    // Validate same chain (CCTPLiFi is for cross-chain only)
    if (tokenIn.chainId === tokenOut.chainId) {
      errors.push('CCTPLiFi route is for cross-chain operations only')
    }

    // Validate swap amount
    if (swapAmount <= 0) {
      errors.push('Swap amount must be positive')
    }

    // Validate max slippage
    if (maxSlippage < 0 || maxSlippage > 1) {
      errors.push('Max slippage must be between 0 and 1')
    }

    // Warning for high slippage
    if (maxSlippage > 0.1) {
      warnings.push(`High slippage tolerance (${(maxSlippage * 100).toFixed(1)}%)`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Estimates gas costs for a CCTPLiFi route
   * @param sourceChainId Source chain ID
   * @param destinationChainId Destination chain ID
   * @param hasSourceSwap Whether route includes source swap
   * @param hasDestinationSwap Whether route includes destination swap
   * @returns Gas estimation details
   */
  static estimateGasCosts(
    sourceChainId: number,
    destinationChainId: number,
    hasSourceSwap: boolean,
    hasDestinationSwap: boolean,
  ): GasEstimation {
    const gasWarnings: string[] = []

    // Base gas estimates (these could be made more dynamic with real-time estimation)
    const baseGasEstimates = {
      swap: 150000n, // Typical DEX swap
      cctpBridge: 100000n, // CCTP depositForBurn
      cctpReceive: 80000n, // CCTP receiveMessage
    }

    // Calculate source chain gas
    let sourceChainGas = baseGasEstimates.cctpBridge // Always need CCTP bridge
    if (hasSourceSwap) {
      sourceChainGas += baseGasEstimates.swap
    }

    // Calculate destination chain gas
    let destinationChainGas = baseGasEstimates.cctpReceive // Always need CCTP receive
    if (hasDestinationSwap) {
      destinationChainGas += baseGasEstimates.swap
    }

    // Estimate USD costs (simplified - could integrate with gas price oracles)
    const totalGasUSD =
      this.estimateGasUSD(sourceChainId, sourceChainGas) +
      this.estimateGasUSD(destinationChainId, destinationChainGas)

    if (sourceChainId === 1 && sourceChainGas > 200000n) {
      gasWarnings.push('High gas usage on Ethereum mainnet - consider gas price timing')
    }

    return {
      sourceChainGas,
      destinationChainGas,
      totalGasUSD,
      gasWarnings,
    }
  }

  /**
   * Estimates gas cost in USD for a given chain and gas amount
   */
  private static estimateGasUSD(chainId: number, gasAmount: bigint): number {
    // Simplified gas price estimates (in gwei) - could be enhanced with real-time data
    const gasPrices = {
      1: 20, // Ethereum
      10: 0.001, // Optimism
      137: 30, // Polygon
      8453: 0.1, // Base
      42161: 0.1, // Arbitrum
    }

    // ETH price approximation for gas cost calculation
    const ethPriceUSD = 2500

    const gasPriceGwei = gasPrices[chainId] || 1
    const gasPriceWei = gasPriceGwei * 1e9
    const gasCostWei = Number(gasAmount) * gasPriceWei
    const gasCostETH = gasCostWei / 1e18

    return gasCostETH * ethPriceUSD
  }
}
