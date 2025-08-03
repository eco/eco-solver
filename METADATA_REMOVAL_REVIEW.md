# Intent Metadata Removal Review

## Summary

Successfully removed the metadata field from the Intent interface and moved strategy configuration to the config module. The system now uses environment-based configuration for strategy selection instead of runtime metadata.

## Changes Made

### 1. Intent Structure Simplified
- **Removed**: Optional `metadata` field from Intent interface
- **Removed**: Metadata property from Intent MongoDB schema
- **Updated**: IntentConverter to no longer handle metadata conversion
- **Result**: Cleaner Intent structure focused only on essential routing and reward data

### 2. Configuration-Based Strategy Selection
- **Added**: `fulfillment` section to config schema with:
  - `defaultStrategy`: Configurable default strategy (standard, crowd-liquidity, etc.)
  - `strategies`: Enable/disable flags for each strategy type
- **Created**: `FulfillmentConfigService` for typed access to fulfillment configuration
- **Environment Variables**:
  ```
  FULFILLMENT_DEFAULT_STRATEGY=standard
  FULFILLMENT_STRATEGIES_STANDARD_ENABLED=true
  FULFILLMENT_STRATEGIES_CROWD_LIQUIDITY_ENABLED=true
  FULFILLMENT_STRATEGIES_NATIVE_INTENTS_ENABLED=true
  FULFILLMENT_STRATEGIES_NEGATIVE_INTENTS_ENABLED=true
  FULFILLMENT_STRATEGIES_RHINESTONE_ENABLED=true
  ```

### 3. Strategy Determination Changes
- **BaseChainListener**: Now uses `FulfillmentConfigService.defaultStrategy` instead of checking metadata
- **Strategy Comments**: Added guidance for future property-based strategy detection

### 4. Blockchain Listeners Updated
- **EVM Listener**: Removed evmTxHash and timestamp metadata
- **Solana Listener**: Removed solanaSignature and timestamp metadata
- **Dependency Injection**: Added FulfillmentConfigService to all listeners

### 5. Fulfillment Strategies Updated
- **Standard**: Now returns `true` for all intents (default strategy)
- **Native Intents**: Checks for no token transfers and native value > 0
- **Other Strategies**: Currently return `false` (require explicit configuration)
- **Removed**: All metadata-based canHandle logic and TODO comments

### 6. Service Updates
- **BlockchainService**: Removed metadata from status updates
- **FulfillmentService**: Replaced metadata errors with console logging

### 7. Documentation Updates
- **CLAUDE.md**: 
  - Removed metadata from Intent interface documentation
  - Updated strategy selection description
  - Added fulfillment configuration section
  - Updated blockchain listener documentation

## Benefits

1. **Simpler Intent Structure**: Intent objects are now focused purely on routing and rewards
2. **Centralized Configuration**: Strategy behavior controlled via environment variables
3. **Type Safety**: No more dynamic metadata typing issues
4. **Clearer Architecture**: Strategy selection logic is now explicit and predictable
5. **Easier Testing**: Configuration-based approach simplifies unit testing

## Migration Notes

For existing deployments:
1. Set `FULFILLMENT_DEFAULT_STRATEGY` environment variable
2. Configure strategy enable flags as needed
3. Remove any code that sets intent metadata
4. Update any monitoring/logging that expects metadata

## Future Enhancements

The strategies now have comments suggesting how to detect strategy types from intent properties:
- Native intents: Check for native-only transfers
- Crowd liquidity: Analyze token amounts and routes
- Rhinestone: Detect smart account patterns
- Negative intents: Identify debt/borrowing patterns

These can be implemented as needed while maintaining the configuration-based override system.