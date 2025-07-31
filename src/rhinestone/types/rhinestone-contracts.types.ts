import { ContractFunctionArgs } from 'viem'
import { ecoAdapterAbi } from '@/contracts/rhinestone/EcoAdapter'
import { rhinestoneRouterAbi } from '@/contracts/rhinestone/RhinestoneRouter'

export type RhinestoneClaimData = ContractFunctionArgs<
  typeof ecoAdapterAbi,
  'nonpayable',
  'eco_handleClaim'
>[0]

export type RhinestoneOrder = RhinestoneClaimData['order']

export type RhinestoneRouterRouteFill = ContractFunctionArgs<
  typeof rhinestoneRouterAbi,
  'payable',
  'routeFill'
>

export type RhinestoneRouterRouteCall = ContractFunctionArgs<
  typeof rhinestoneRouterAbi,
  'payable',
  'routeClaim'
>

export type RhinestoneRouterRouteFn =
  | { functionName: 'routeFill'; args: RhinestoneRouterRouteFill }
  | { functionName: 'routeClaim'; args: RhinestoneRouterRouteCall }
