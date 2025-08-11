export interface ValidateVaultFundingArgs {
  client: PublicClient
  intentSourceAddress: Address
  intentHash: Hex
  preventRedundantFunding?: boolean
}
