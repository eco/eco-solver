export interface PermitValidationArgs {
  chainId: number
  permits?: PermitDTO[]
  permit2?: Permit2DTO
  reward: QuoteRewardDataDTO
  spender: Address
  owner: Address
  intentHash?: Hex
  expectedVault?: Address
}
