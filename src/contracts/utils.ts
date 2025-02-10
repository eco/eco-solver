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
