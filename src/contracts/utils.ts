import { Abi, AbiStateMutability, ContractFunctionName, Hex } from 'viem'
import { TargetContractType } from '../eco-configs/eco-config.types'
import { ERC20Abi } from './ERC20.contract'
import { EcoError } from '../common/errors/eco-error'

/**
 * Get the ABI for the target ERC contract
 * @param targetType
 */
export function getERCAbi(targetType: TargetContractType): Abi {
  switch (targetType) {
    case 'erc20':
      return ERC20Abi
    case 'erc721':
    case 'erc1155':
    default:
      throw EcoError.IntentSourceUnsupportedTargetType(targetType)
  }
}

/**
 * The type for a call to a contract, used for typing multicall mappings
 */
export type ViemCall<
  abi extends Abi,
  mutability extends AbiStateMutability = AbiStateMutability,
> = {
  address: Hex
  abi: abi
  functionName: ContractFunctionName<abi, mutability>
}

/**
 * The type of an array
 */
export type GetElementType<T> = T extends (infer U)[] ? U : never

/**
 * Removes the readonly modifier entire object
 */
export type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

/**
 * Removes the readonly modifier from a field
 */
export type MutableField<T, K extends keyof T> = Omit<T, K> & {
  -readonly [P in K]: T[P]
}
