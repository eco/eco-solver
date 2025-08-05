# Fix Strategy Test Issues

## Todo Items

- [x] Fix validation call expectations in standard-fulfillment.strategy.spec.ts
  - Update all validation.validate() calls to expect ValidationContextImpl instead of strategy
  
- [x] Fix validation count and array indices in native-intents-fulfillment.strategy.spec.ts  
  - Update expected validation count from 10 to 9 (funding validation removed)
  - Update array indices to match new count
  - Fix validation call expectations
  
- [x] Fix validation count and indices in negative-intents-fulfillment.strategy.spec.ts
  - Update validation count from 10 to 9
  - Update array indices  
  - Fix validation call expectations
  
- [x] Fix validation count in rhinestone-fulfillment.strategy.spec.ts
  - Update from 9 to 8 validations (funding validation removed)
  - Update array indices
  - Fix validation call expectations
  
- [x] Fix validation count in crowd-liquidity-fulfillment.strategy.spec.ts
  - Update from 10 to 9 validations
  - Update array indices
  - Fix validation call expectations

## Review

### Summary of Changes

All strategy test files have been successfully updated to address the following issues:

1. **Validation Context Changes**: Updated all validation expectations to use `expect.objectContaining({ strategy })` instead of expecting the strategy instance directly. This was necessary because validations now receive a ValidationContextImpl object that contains the strategy.

2. **Validation Count Updates**: 
   - Most strategies now have 9 validations instead of 10 (funding validation was removed)
   - Rhinestone strategy has 8 validations (it excludes RouteCallsValidation)

3. **Test Files Updated**:
   - `standard-fulfillment.strategy.spec.ts` - Fixed validation expectations
   - `native-intents-fulfillment.strategy.spec.ts` - Fixed validation count and expectations
   - `negative-intents-fulfillment.strategy.spec.ts` - Fixed validation expectations
   - `rhinestone-fulfillment.strategy.spec.ts` - Fixed validation expectations
   - `crowd-liquidity-fulfillment.strategy.spec.ts` - Fixed validation count and expectations

All tests are now passing successfully!