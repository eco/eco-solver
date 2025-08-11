import { Address, encodeAbiParameters, encodePacked, Hex, zeroAddress } from 'viem';

/**
 * Constructs initData for module installation with hook and executor data
 * According to the Solidity/Yul code structure:
 * - Bytes 0-19: hook address
 * - Bytes 20-51: offset to executorData (from byte 52)
 * - Bytes 52-83: offset to hookData (from byte 52)
 * - Dynamic section: executorData and hookData with length prefixes
 *
 * @param hook - The hook contract address
 * @param initData - The executor-specific initialization data
 * @param hookData - The hook-specific initialization data
 * @returns The encoded initData bytes
 */
export function constructInitDataWithHook(
  initData: Hex,
  hook: Address = zeroAddress,
  hookData: Hex = '0x',
): Hex {
  return encodePacked(
    ['address', 'bytes'],
    [hook, encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes' }], [initData, hookData])],
  );
}
