import { DecodeFunctionDataReturnType, Hex } from 'viem'
import { TargetContract } from '@eco/infrastructure-config'
import { QuoteIntentDataInterface } from '../quote/dto/quote.intent.data.dto'
import { Network } from '../common/alchemy/network'

/**
 * Data for a transaction target
 */
export interface TransactionTargetData {
  decodedFunctionData: DecodeFunctionDataReturnType
  selector: Hex
  targetConfig: TargetContract
}

/**
 * Type for logging in validations
 */
export interface IntentLogType {
  hash?: Hex
  sourceNetwork?: Network
}

interface IntentModelWithHashInterface {
  hash?: Hex
}

/**
 * Validation type that mixes the QuoteIntentDataDTO with the hash. This is used to
 * merge quotes and intents validations
 */
export interface ValidationIntentInterface
  extends QuoteIntentDataInterface,
    IntentModelWithHashInterface {}

/**
 * Type that holds all the possible validations that can fail
 */
export type ValidationChecks = {
  supportedProver: boolean
  supportedNative: boolean
  supportedTargets: boolean
  supportedTransaction: boolean
  validTransferLimit: boolean
  validExpirationTime: boolean
  validDestination: boolean
  fulfillOnDifferentChain: boolean
  sufficientBalance: boolean
}

/**
 * Type that holds all the possible validations that can fail
 */
export type ValidationType = {
  [key in keyof ValidationChecks]: boolean
}

export type TxValidationFn = (tx: TransactionTargetData) => boolean

/**
 * Validates that all the validations succeeded
 * @param validations  the validations to check
 * @returns true if all the validations passed
 */
export function validationsSucceeded(validations: ValidationType): boolean {
  return Object.values(validations).every((v) => v)
}

/**
 * Checks that at least one of the validations failed
 * @param validations the validations to check
 * @returns true if any of the validations failed
 */
export function validationsFailed(validations: ValidationType): boolean {
  return !validationsSucceeded(validations)
}