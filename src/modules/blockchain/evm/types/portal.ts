import { ContractFunctionArgs } from 'viem';

import { PortalAbi } from '@/common/abis/portal.abi';

export type EVMIntentType = ContractFunctionArgs<typeof PortalAbi, 'pure', 'getIntentHash'>[number];
