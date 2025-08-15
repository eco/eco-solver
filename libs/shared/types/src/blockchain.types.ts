import { DecodeFunctionDataReturnType } from 'viem'
import { Hex } from 'viem'
import { TargetContractType } from './contract.types'

/**
 * Data for a blockchain transaction target
 * Shared interface for transaction target analysis
 */
export interface TransactionTargetData {
  decodedFunctionData: DecodeFunctionDataReturnType
  selector: Hex
  targetConfig: {
    contractType: TargetContractType
    selectors: string[]
  }
}