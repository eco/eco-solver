import { ContractFunctionArgs } from 'viem'
import { ecoAdapterAbi } from '@/contracts/rhinestone/EcoAdapter'
import { rhinestoneRouterAbi } from '@/contracts/rhinestone/RhinestoneRouter'

/**
 * Type for claim data arguments to eco_handleClaim function
 */
export type RhinestoneClaimData = ContractFunctionArgs<
  typeof ecoAdapterAbi,
  'nonpayable',
  'eco_handleClaim'
>[0]

/**
 * Type for Rhinestone order extracted from claim data
 */
export type RhinestoneOrder = RhinestoneClaimData['order']

/**
 * Type for arguments to the routeFill function on the router
 */
export type RhinestoneRouterRouteFill = ContractFunctionArgs<
  typeof rhinestoneRouterAbi,
  'payable',
  'routeFill'
>

/**
 * Type for arguments to the routeClaim function on the router
 */
export type RhinestoneRouterRouteCall = ContractFunctionArgs<
  typeof rhinestoneRouterAbi,
  'payable',
  'routeClaim'
>

/**
 * Union type for router function calls (routeFill or routeClaim)
 */
export type RhinestoneRouterRouteFn =
  | { functionName: 'routeFill'; args: RhinestoneRouterRouteFill }
  | { functionName: 'routeClaim'; args: RhinestoneRouterRouteCall }
