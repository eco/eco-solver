import { ContractFunctionArgs } from 'viem'
import { ecoAdapterAbi } from '@/contracts/rhinestone/EcoAdapter'

export type RhinestoneClaimData = ContractFunctionArgs<
  typeof ecoAdapterAbi,
  'nonpayable',
  'eco_handleClaim'
>[0]

export type RhinestoneOrder = RhinestoneClaimData['order']
