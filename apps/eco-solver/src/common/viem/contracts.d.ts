import { Abi, ContractFunctionName, Hex, PrepareEncodeFunctionDataParameters } from 'viem';
/**
 * Gets the hex selector of the function.
 * @param parameters the parameters to encode, abi and functionName
 * @returns the hex selector of the function
 */
export declare function getSelector<const abi extends Abi | readonly unknown[], functionName extends ContractFunctionName<abi>>(parameters: PrepareEncodeFunctionDataParameters<abi, functionName>): Hex;
export declare function getFunctionBytes(data: Hex): Hex;
