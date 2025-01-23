import { Abi, AbiParameter, AbiStateMutability, ContractFunctionName, Hex } from 'viem'
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

/**
 * Extracts the ABI struct with the given name
 * @param params the abi
 * @param structName the name of the struct
 */
export function extractAbiStruct<abi extends Abi, AbiReturn extends readonly AbiParameter[]>(
  abi: abi,
  structName: string,
): AbiReturn {
  const obj = extractAbiStructRecursive<abi, AbiReturn>(abi, structName)
  if (!obj) {
    throw EcoError.ExtractAbiStructFailed(structName)
  }
  return obj
}
/**
 * Recursively extracts the ABI struct with the given name
 * @param params the abi
 * @param structName the name of the struct
 */
function extractAbiStructRecursive<abi extends Abi, AbiReturn extends readonly AbiParameter[]>(
  abi: abi,
  structName: string,
): AbiReturn | undefined {
  for (const item of abi) {
    const obj = item as any
    if (obj.name === structName) {
      return obj as AbiReturn
    }
    if (obj.inputs) {
      const result = extractAbiStructRecursive(obj.inputs, structName)
      if (result) {
        return result as AbiReturn
      }
    }
    if (obj.components) {
      const result = extractAbiStructRecursive(obj.components, structName)
      if (result) {
        return result as AbiReturn
      }
    }
  }
}
