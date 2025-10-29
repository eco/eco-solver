import { ContractFunctionArgs } from 'viem';

import { ecoAdapterAbi } from '@/common/abis/eco-adapter.abi';

/**
 * Claim data type derived from eco_compact_handleClaim ABI
 */
export type ClaimData = ContractFunctionArgs<
  typeof ecoAdapterAbi,
  'nonpayable',
  'eco_compact_handleClaim'
>[0];

/**
 * Rhinestone Order type extracted from ClaimData
 */
export type RhinestoneOrder = ClaimData['order'];

/**
 * Fill data type derived from eco_handleFill ABI
 */
export type FillData = ContractFunctionArgs<
  typeof ecoAdapterAbi,
  'nonpayable',
  'eco_permit2_handleClaim_optimized'
>[0];
