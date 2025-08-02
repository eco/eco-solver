# Todo List - Update Validation Files for New Intent Structure

## Tasks

1. [ ] Update route-token.validation.ts to use new Intent structure
2. [ ] Update route-calls.validation.ts to use new Intent structure  
3. [ ] Update route-amount-limit.validation.ts to use new Intent structure
4. [ ] Update prover-support.validation.ts to use new Intent structure
5. [ ] Update executor-balance.validation.ts to use new Intent structure
6. [ ] Update standard-fee.validation.ts to use new Intent structure
7. [ ] Update crowd-liquidity-fee.validation.ts to use new Intent structure
8. [ ] Update native-fee.validation.ts to use new Intent structure

## Key Changes Required
1. Import Intent from '@/common/interfaces/intent.interface' instead of modules path
2. Use intent.route.source/destination instead of intent.source.chainId/target.chainId
3. Use intent.route.tokens[].amount for token amounts
4. Use intent.route.calls[].value for call values
5. Use intent.reward.nativeValue for reward value
6. Use intent.reward.deadline instead of intent.deadline
7. Handle bigint types properly throughout

## Notes
- The new Intent interface uses nested objects for better organization
- Chain IDs are now bigint type in route.source and route.destination
- Token and call information is now in arrays within the route object
- Reward information is in a separate reward object with prover, creator, deadline, and value details