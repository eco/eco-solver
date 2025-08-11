/*
 * This interface defines the parameters required for processing a permit.
 * It includes the chain ID, permit details, owner address, spender address, and value.
 */
export interface PermitProcessingParams {
  chainID: number
  permit: PermitDTO
  owner: Hex
  spender: Hex
  value: bigint
}
