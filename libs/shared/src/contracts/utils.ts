import { Abi, AbiStateMutability, ContractFunctionName, Hex } from 'viem'
import { ERC20Abi } from './ERC20.contract'
import { EcoError } from '@libs/shared/errors'

// TODO: This type should come from domain or integrations to avoid circular deps
type TargetContractType = 'erc20' | 'erc721' | 'erc1155'

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
