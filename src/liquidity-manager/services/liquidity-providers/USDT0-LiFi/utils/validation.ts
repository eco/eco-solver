import { TokenData } from '@/liquidity-manager/types/types'
import { USDT0LiFiRoutePlanner } from './route-planner'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

export class USDT0LiFiValidator {
  static validateRoute(
    tokenIn: TokenData,
    tokenOut: TokenData,
    swapAmount: number,
    maxSlippage: number,
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (tokenIn.chainId === tokenOut.chainId) errors.push('USDT0LiFi is cross-chain only')

    if (!USDT0LiFiRoutePlanner.validateUSDT0Support(tokenIn.chainId, tokenOut.chainId)) {
      errors.push(`USDT0 not supported for ${tokenIn.chainId} → ${tokenOut.chainId}`)
    }

    if (swapAmount <= 0) errors.push('Swap amount must be positive')
    if (maxSlippage < 0 || maxSlippage > 1) errors.push('Max slippage must be between 0 and 1')

    if (maxSlippage > 0.1)
      warnings.push(`High slippage tolerance (${(maxSlippage * 100).toFixed(1)}%)`)

    return { isValid: errors.length === 0, errors, warnings }
  }
}
