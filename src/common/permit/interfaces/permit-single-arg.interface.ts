import { Hex } from 'viem'
import { PermitDetails } from '@/common/permit/interfaces/permit-details.interface'

export interface PermitSingleArg {
  details: PermitDetails
  spender: Hex
  sigDeadline: bigint
}
