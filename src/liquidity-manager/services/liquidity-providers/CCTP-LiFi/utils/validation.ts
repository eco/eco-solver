import { TokenData } from '@/liquidity-manager/types/types'
import { CCTPLiFiRoutePlanner } from './route-planner'
import { formatUnits } from 'viem'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

export interface AdvancedValidationOptions {
  maxSlippage: number
  minLiquidityUSD?: number
  maxGasEstimate?: bigint
  skipBalanceCheck?: boolean
  skipGasEstimation?: boolean
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
   * @param skipBalanceCheck Skip balance validation
   * @returns Validation result with errors if any
   */
  static validateRoute(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    maxSlippage: number,
    skipBalanceCheck = false,
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

    // Validate sufficient balance (only if not skipping)
    if (!skipBalanceCheck) {
      const tokenBalance = parseFloat(
        formatUnits(tokenIn.balance.balance, tokenIn.balance.decimals),
      )
      if (swapAmount > tokenBalance) {
        errors.push(
          `Insufficient balance: ${swapAmount} > ${tokenBalance} ${tokenIn.balance.address}`,
        )
      }
    }

    // Warning for small amounts that may have high gas costs relative to value
    if (swapAmount < 100) {
      warnings.push(`Small swap amount (${swapAmount}) may have high gas costs relative to value`)
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
   * Advanced validation with additional options
   * @param tokenIn Source token
   * @param tokenOut Destination token
   * @param swapAmount Amount to swap
   * @param options Advanced validation options
   * @returns Enhanced validation result
   */
  static validateAdvanced(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    options: AdvancedValidationOptions,
  ): ValidationResult {
    // Start with basic validation
    const basicResult = this.validateRoute(tokenIn, tokenOut, swapAmount, options.maxSlippage)
    const errors = [...basicResult.errors]
    const warnings = [...(basicResult.warnings || [])]

    // Additional validations based on options
    if (!options.skipBalanceCheck) {
      const balanceResult = this.validateBalances(tokenIn, swapAmount, swapAmount)
      if (!balanceResult.isValid) {
        errors.push(...balanceResult.errors)
      }
    }

    // Validate minimum liquidity if specified
    if (options.minLiquidityUSD && swapAmount < options.minLiquidityUSD) {
      warnings.push(
        `Swap amount below minimum recommended liquidity (${swapAmount} < ${options.minLiquidityUSD} USD)`,
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validates that required balances exist for all steps
   * @param tokenIn Source token
   * @param sourceSwapAmount Amount needed for source swap (if any)
   * @param cctpAmount Amount needed for CCTP bridge
   * @returns Validation result
   */
  static validateBalances(
    tokenIn: TokenData,
    sourceSwapAmount: number,
    cctpAmount: number,
  ): ValidationResult {
    const errors: string[] = []
    const availableBalance = parseFloat(
      formatUnits(tokenIn.balance.balance, tokenIn.balance.decimals),
    )

    // For routes that need a source swap, validate we have enough of the input token
    if (sourceSwapAmount > 0 && sourceSwapAmount > availableBalance) {
      errors.push(
        `Insufficient ${tokenIn.balance.address} balance for source swap: ${sourceSwapAmount} > ${availableBalance}`,
      )
    }

    // For CCTP, we need USDC on the source chain
    if (cctpAmount > 0) {
      // If source token is not USDC, this will be validated by the source swap
      // If source token is USDC, validate directly
      if (CCTPLiFiRoutePlanner.isUSDC(tokenIn) && cctpAmount > availableBalance) {
        errors.push(
          `Insufficient USDC balance for CCTP bridge: ${cctpAmount} > ${availableBalance}`,
        )
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validates gas estimation for multi-step operations
   * @param estimatedGasSource Estimated gas for source chain operations
   * @param estimatedGasDestination Estimated gas for destination chain operations
   * @param maxGasLimit Maximum acceptable gas limit
   * @returns Validation result
   */
  static validateGasEstimation(
    estimatedGasSource: bigint,
    estimatedGasDestination: bigint,
    maxGasLimit: bigint,
  ): ValidationResult {
    const errors: string[] = []

    if (estimatedGasSource > maxGasLimit) {
      errors.push(
        `Source chain gas estimation exceeds limit: ${estimatedGasSource} > ${maxGasLimit}`,
      )
    }

    if (estimatedGasDestination > maxGasLimit) {
      errors.push(
        `Destination chain gas estimation exceeds limit: ${estimatedGasDestination} > ${maxGasLimit}`,
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validates route efficiency compared to direct alternatives
   * @param estimatedCost Total estimated cost for CCTPLiFi route
   * @param estimatedTime Total estimated time for CCTPLiFi route (minutes)
   * @param directAlternative Direct route cost/time if available
   * @returns Validation result with efficiency warnings
   */
  static validateRouteEfficiency(
    estimatedCost: number,
    estimatedTime: number,
    directAlternative?: { cost: number; time: number },
  ): ValidationResult {
    const warnings: string[] = []

    // Warn about long execution times
    if (estimatedTime > 30) {
      warnings.push(`Long estimated execution time: ${estimatedTime} minutes`)
    }

    // Compare with direct alternative if available
    if (directAlternative) {
      const costIncrease = (estimatedCost - directAlternative.cost) / directAlternative.cost
      const timeIncrease = (estimatedTime - directAlternative.time) / directAlternative.time

      if (costIncrease > 0.2) {
        warnings.push(
          `CCTPLiFi route is ${(costIncrease * 100).toFixed(1)}% more expensive than direct route`,
        )
      }

      if (timeIncrease > 1.0) {
        warnings.push(
          `CCTPLiFi route takes ${(timeIncrease * 100).toFixed(1)}% longer than direct route`,
        )
      }
    }

    return {
      isValid: true, // Efficiency warnings don't make route invalid
      errors: [],
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

    // Add warnings for high gas scenarios
    if (totalGasUSD > 50) {
      gasWarnings.push(`High estimated gas cost: $${totalGasUSD.toFixed(2)}`)
    }

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
    const ethPriceUSD = 2000

    const gasPriceGwei = gasPrices[chainId] || 1
    const gasPriceWei = gasPriceGwei * 1e9
    const gasCostWei = Number(gasAmount) * gasPriceWei
    const gasCostETH = gasCostWei / 1e18

    return gasCostETH * ethPriceUSD
  }
}
