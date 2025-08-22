import { Abi, AbiStateMutability, ContractFunctionName } from 'viem';
import { Hex } from 'viem';
import { TargetContractType } from '@libs/solver-config';
/**
 * The type for a call to a contract, used for typing multicall mappings
 */
export type ViemCall<abi extends Abi, mutability extends AbiStateMutability = AbiStateMutability> = {
    address: Hex;
    abi: abi;
    functionName: ContractFunctionName<abi, mutability>;
};
/**
 * Get the ABI for the target ERC contract
 * @param targetType
 */
export declare function getERCAbi(targetType: TargetContractType): Abi;
