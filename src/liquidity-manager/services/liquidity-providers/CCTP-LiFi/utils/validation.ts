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
