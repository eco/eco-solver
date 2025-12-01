export interface GasEstimation {
  sourceChainGas: bigint
  destinationChainGas: bigint
  totalGasUSD: number
  gasWarnings: string[]
}

export class CCIPLiFiValidator {
  /**
   * Estimates gas costs for a CCIPLiFi route
   */
  static estimateGasCosts(
    sourceChainId: number,
    destinationChainId: number,
    hasSourceSwap: boolean,
    hasDestinationSwap: boolean,
  ): GasEstimation {
    const gasWarnings: string[] = []

    const baseGasEstimates = {
      swap: 150000n,
      ccipSend: 200000n,
      ccipReceive: 100000n,
    }

    let sourceChainGas = baseGasEstimates.ccipSend
    if (hasSourceSwap) {
      sourceChainGas += baseGasEstimates.swap
    }

    let destinationChainGas = baseGasEstimates.ccipReceive
    if (hasDestinationSwap) {
      destinationChainGas += baseGasEstimates.swap
    }

    const totalGasUSD =
      this.estimateGasUSD(sourceChainId, sourceChainGas) +
      this.estimateGasUSD(destinationChainId, destinationChainGas)

    if (sourceChainId === 1 && sourceChainGas > 300000n) {
      gasWarnings.push('High gas usage on Ethereum mainnet')
    }

    return {
      sourceChainGas,
      destinationChainGas,
      totalGasUSD,
      gasWarnings,
    }
  }

  private static estimateGasUSD(chainId: number, gasAmount: bigint): number {
    const gasPrices: Record<number, number> = {
      1: 20,
      10: 0.001,
      137: 30,
      8453: 0.1,
      42161: 0.1,
    }

    const ethPriceUSD = 2500
    const gasPriceGwei = gasPrices[chainId] || 1
    const gasPriceWei = gasPriceGwei * 1e9
    const gasCostWei = Number(gasAmount) * gasPriceWei
    const gasCostETH = gasCostWei / 1e18

    return gasCostETH * ethPriceUSD
  }
}
