import { Address, Hex } from 'viem'
import { PermitDTO } from '@eco-solver/quote/dto/permit/permit.dto'
import { Permit2DTO } from '@eco-solver/quote/dto/permit2/permit2.dto'
import { QuoteRewardDataDTO } from '@eco-solver/quote/dto/quote.reward.data.dto'

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
