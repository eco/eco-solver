import { Address, PublicClient } from "viem"
import { Hex } from "viem"

export interface ValidateVaultFundingArgs {
  client: PublicClient
  intentSourceAddress: Address
  intentHash: Hex
  preventRedundantFunding?: boolean
}
