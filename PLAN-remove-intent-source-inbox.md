# Architectural Plan: Remove Intent Source and Inbox Components

## Executive Summary

This document outlines a comprehensive plan to remove all references to the deprecated `intentSource` and `inbox` components from the codebase. These components have been superseded by the Portal contract system but remain in the configuration schemas and services. The removal requires careful coordination across configuration, services, and test files to ensure no breaking changes.

## Current State Analysis

### Components Using Intent Source/Inbox

#### 1. Configuration Layer
- **EVM Schema** (`src/config/schemas/evm.schema.ts`)
  - Lines 140-141: `intentSourceAddress` and `inboxAddress` fields in network schema
  - These are required fields in the configuration validation

- **TVM Schema** (`src/config/schemas/tvm.schema.ts`)
  - Lines 84-85: `intentSourceAddress` and `inboxAddress` fields in network schema
  - Similar required fields for TVM networks

#### 2. Configuration Services
- **EvmConfigService** (`src/modules/config/services/evm-config.service.ts`)
  - Lines 94-102: Methods `getIntentSourceAddress()` and `getInboxAddress()`
  - These methods retrieve deprecated addresses from configuration

- **TvmConfigService** (`src/modules/config/services/tvm-config.service.ts`)
  - Similar methods for TVM chain configuration

- **BlockchainConfigService** (`src/modules/config/services/blockchain-config.service.ts`)
  - Lines 84-119: Methods `getIntentSourceAddress()` and `getInboxAddress()`
  - Cross-chain wrapper methods that delegate to chain-specific configs

#### 3. Listener Services
- **EvmListenersManagerService** (`src/modules/blockchain/evm/listeners/evm-listeners-manager.service.ts`)
  - Lines 33-34: Retrieves inbox and intent source addresses for listener configuration
  - Passes these to ChainListener constructor

- **ChainListener** (`src/modules/blockchain/evm/listeners/chain.listener.ts`)
  - Receives configuration with these addresses but doesn't actually use them
  - Already migrated to use Portal events

- **TvmListenersManagerService** (`src/modules/blockchain/tvm/listeners/tvm-listeners-manager.service.ts`)
  - Similar pattern for TVM chain listeners

#### 4. Common Interfaces
- **ChainConfig Interface** (`src/common/interfaces/chain-config.interface.ts`)
  - Defines `intentSourceAddress` and `inboxAddress` as required fields
  - Used by listener configurations

#### 5. Test Files
Multiple test files reference these components in mock data and test configurations:
- Test configurations in `*.spec.ts` files
- Mock data generators
- Integration test setups

#### 6. Documentation & Examples
- `.env.example` file contains example values
- API documentation references these fields
- README files mention configuration requirements

## Proposed Architecture/Solution

### Design Principles
1. **Clean Removal**: Remove all traces of intent source and inbox without leaving dead code
2. **Backward Compatibility**: Ensure existing Portal functionality remains intact
3. **Type Safety**: Update TypeScript interfaces to reflect the changes
4. **Test Coverage**: Update all tests to work with the new structure

### Key Changes
1. Remove `intentSourceAddress` and `inboxAddress` from all configuration schemas
2. Remove getter methods from configuration services
3. Update listener initialization to not require these addresses
4. Clean up interfaces and types
5. Update all test fixtures and mocks
6. Update documentation

## Implementation Phases

### Phase 1: Update Configuration Schemas (Critical Path)
**Priority**: High  
**Risk**: Medium - Breaking change for configuration

#### Tasks:
1. **Update EVM Schema** (`src/config/schemas/evm.schema.ts`)
   - Remove lines 140-141 (`intentSourceAddress`, `inboxAddress`)
   - Ensure schema validation still works without these fields

2. **Update TVM Schema** (`src/config/schemas/tvm.schema.ts`)
   - Remove lines 84-85 (`intentSourceAddress`, `inboxAddress`)
   - Maintain schema consistency

3. **Update Chain Config Interface** (`src/common/interfaces/chain-config.interface.ts`)
   - Remove `intentSourceAddress` and `inboxAddress` from interface definitions
   - Update any dependent types

**Dependencies**: None  
**Estimated Effort**: Low (1 hour)

### Phase 2: Remove Configuration Service Methods
**Priority**: High  
**Risk**: Medium - Services using these methods will break

#### Tasks:
1. **Update EvmConfigService** (`src/modules/config/services/evm-config.service.ts`)
   - Remove methods `getIntentSourceAddress()` (lines 94-97)
   - Remove method `getInboxAddress()` (lines 99-102)

2. **Update TvmConfigService** (`src/modules/config/services/tvm-config.service.ts`)
   - Remove corresponding methods

3. **Update BlockchainConfigService** (`src/modules/config/services/blockchain-config.service.ts`)
   - Remove `getIntentSourceAddress()` method (lines 84-100)
   - Remove `getInboxAddress()` method (lines 103-119)

**Dependencies**: Phase 1  
**Estimated Effort**: Low (1 hour)

### Phase 3: Update Listener Services
**Priority**: High  
**Risk**: Low - Listeners already use Portal

#### Tasks:
1. **Update EvmListenersManagerService** (`src/modules/blockchain/evm/listeners/evm-listeners-manager.service.ts`)
   - Remove lines 33-34 that retrieve deprecated addresses
   - Update ChainListener constructor call to not pass these addresses

2. **Update TvmListenersManagerService** (`src/modules/blockchain/tvm/listeners/tvm-listeners-manager.service.ts`)
   - Similar updates for TVM listeners

3. **Update ChainListener Constructor**
   - Remove unused parameters from constructor if present
   - Update interface definitions

**Dependencies**: Phase 2  
**Estimated Effort**: Medium (2 hours)

### Phase 4: Update Test Files
**Priority**: Medium  
**Risk**: Low - Tests only

#### Tasks:
1. **Update Unit Tests**
   - Search and remove all references to `intentSourceAddress` in test mocks
   - Search and remove all references to `inboxAddress` in test mocks
   - Update test configuration builders

2. **Update Integration Tests**
   - Remove deprecated fields from test environment setup
   - Update test data generators

3. **Update Mock Data**
   - Clean up mock intent creation helpers
   - Remove deprecated fields from test fixtures

**Files to Update** (partial list):
- `src/modules/config/services/tests/evm-config.service.spec.ts`
- `src/modules/blockchain/evm/listeners/tests/*.spec.ts`
- `src/modules/blockchain/tvm/listeners/tests/*.spec.ts`
- Test helper files and mock generators

**Dependencies**: Phase 3  
**Estimated Effort**: High (3-4 hours)

### Phase 5: Update Documentation and Examples
**Priority**: Low  
**Risk**: None

#### Tasks:
1. **Update .env.example**
   - Remove `EVM_NETWORKS_*_INTENT_SOURCE_ADDRESS` examples
   - Remove `EVM_NETWORKS_*_INBOX_ADDRESS` examples
   - Remove TVM equivalents

2. **Update Configuration Documentation**
   - Remove references from README files
   - Update API documentation
   - Update configuration guides

3. **Update Migration Guides**
   - Add notes about removal of these fields
   - Provide migration path for users

**Dependencies**: Phase 4  
**Estimated Effort**: Low (1 hour)

## Technical Specifications

### Removed Configuration Fields
```typescript
// BEFORE - EVM Network Schema
{
  chainId: number,
  intentSourceAddress: string,  // REMOVE
  inboxAddress: string,         // REMOVE
  portalAddress: string,        // KEEP
  // ... other fields
}

// AFTER - EVM Network Schema
{
  chainId: number,
  portalAddress: string,        // Portal is the only contract needed
  // ... other fields
}
```

### Removed Service Methods
```typescript
// Methods to remove from all config services:
getIntentSourceAddress(chainId: number): Address
getInboxAddress(chainId: number): Address
```

### Updated Listener Configuration
```typescript
// BEFORE
const config: EvmChainConfig = {
  chainType: 'EVM',
  chainId: network.chainId,
  inboxAddress: this.evmConfigService.getInboxAddress(network.chainId),      // REMOVE
  intentSourceAddress: this.evmConfigService.getIntentSourceAddress(network.chainId), // REMOVE
};

// AFTER
const config: EvmChainConfig = {
  chainType: 'EVM',
  chainId: network.chainId,
  // Portal address is retrieved when needed via blockchainConfigService
};
```

## Risk Assessment and Mitigation

### High Risk Areas
1. **Configuration Breaking Change**
   - **Risk**: Existing deployments with intent source/inbox in config will fail validation
   - **Mitigation**: Add migration logic to handle old configs gracefully with warnings
   - **Alternative**: Make fields optional with deprecation warnings first

2. **Service Dependencies**
   - **Risk**: Unknown services might be calling removed methods
   - **Mitigation**: Full codebase search completed, all usage identified

### Medium Risk Areas
1. **Test Breakage**
   - **Risk**: Tests fail due to missing configuration
   - **Mitigation**: Systematic update of all test files

2. **Documentation Confusion**
   - **Risk**: Users following old documentation get errors
   - **Mitigation**: Clear migration guide and updated examples

### Low Risk Areas
1. **Portal Contract Integration**
   - Already fully migrated to Portal
   - No functional impact on intent processing

## Testing Strategy

### Unit Tests
1. Update configuration schema tests to validate without deprecated fields
2. Update service tests to not expect removed methods
3. Verify listener tests work with new configuration

### Integration Tests
1. Test full intent flow without intent source/inbox configuration
2. Verify Portal-based intent discovery works correctly
3. Test configuration loading with new schema

### Manual Testing
1. Start application with updated configuration
2. Verify listeners start successfully
3. Process test intent through the system
4. Confirm no references to removed components in logs

## Rollout Plan

### Development Environment
1. Create feature branch `feature/remove-intent-source-inbox`
2. Implement changes phase by phase
3. Run full test suite after each phase
4. Manual testing in local environment

### Staging Environment
1. Deploy to staging with new configuration
2. Run integration tests
3. Monitor for any errors or warnings
4. Verify intent processing works correctly

### Production Deployment
1. Update production configuration files (remove deprecated fields)
2. Deploy new code version
3. Monitor logs for any issues
4. Rollback plan: Revert to previous version if issues arise

## Success Metrics

### Completion Criteria
- [ ] All configuration schemas updated
- [ ] All service methods removed
- [ ] All listeners updated
- [ ] All tests passing
- [ ] Documentation updated
- [ ] No references to `intentSource` or `inbox` in codebase (except historical docs)

### Verification Steps
1. Global search for `intentSource` returns no results in active code
2. Global search for `inbox` returns no results (except `Inbox` type references in Portal context)
3. Application starts without configuration errors
4. Intent processing works end-to-end
5. All tests pass

## Migration Notes for Users

### Configuration Changes Required
Users must update their configuration files:

**Before:**
```env
EVM_NETWORKS_0_INTENT_SOURCE_ADDRESS=0x123...
EVM_NETWORKS_0_INBOX_ADDRESS=0x456...
EVM_NETWORKS_0_PORTAL_ADDRESS=0x789...
```

**After:**
```env
EVM_NETWORKS_0_PORTAL_ADDRESS=0x789...
# Remove intent source and inbox addresses
```

### API Changes
No API changes - these were internal configuration components only.

### Backward Compatibility
This is a breaking change. Users must update their configuration before upgrading.

## Summary

This plan removes approximately 200+ lines of deprecated code and configuration, simplifying the system architecture while maintaining full functionality through the Portal contract system. The removal is straightforward as the components are no longer actively used, with the Portal contract having fully replaced their functionality.

The main complexity lies in updating all test files and ensuring no breaking changes for existing deployments. The phased approach minimizes risk by allowing validation at each step.

**Total Estimated Effort**: 8-10 hours
**Risk Level**: Medium
**Impact**: Positive - Cleaner codebase, reduced configuration complexity