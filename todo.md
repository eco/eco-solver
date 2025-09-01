# Fix Wallet Test Failures

## Problem Analysis
The wallet tests were failing due to TypeScript type errors in the kernel-wallet factory tests:
1. **Type Mismatch**: Mock network configuration had `contracts.portal` as `string` instead of `\`0x${string}\`` (Viem Hex type)
2. **Mock Implementation**: `mockImplementation` callback parameter needed explicit typing
3. **Address Types**: Some address fields needed proper type casting for Viem compatibility

## Tasks

### 1. Fix TypeScript type errors in kernel-wallet factory tests ✅
- [x] Add proper type casting for `contracts.portal` addresses to `\`0x${string}\`` type
- [x] Fix `mockImplementation` callback parameter typing
- [x] Update address fields in mock configurations to use proper Hex types

### 2. Verify all wallet tests pass ✅
- [x] Run kernel-wallet.factory.spec.ts to confirm fix
- [x] Run all wallet test files to ensure no regressions
- [x] Verify all 77 tests pass across 6 test files

## Review

### Changes Made
1. **Fixed Type Errors**: Updated `/Users/carlosfebres/dev/eco/solver-v2/blockchain-intent-solver/src/modules/blockchain/evm/wallets/kernel-wallet/tests/kernel-wallet.factory.spec.ts`
   - Added `as \`0x${string}\`` type casting to `contracts.portal` properties in mock configurations
   - Added explicit `(chainId: number)` parameter typing to `mockImplementation` callbacks
   - Updated address fields `intentSourceAddress` and `inboxAddress` to use proper Hex type casting

### Test Results
- **All wallet tests now pass**: 77 tests across 6 test files
- **No compilation errors**: TypeScript type checking passes
- **Test files verified**:
  - basic-wallet.factory.spec.ts ✅
  - basic-wallet.spec.ts ✅
  - kms-account.spec.ts ✅
  - encode-transactions.spec.ts ✅
  - kernel-wallet.factory.spec.ts ✅ (was failing, now fixed)
  - kernel-wallet.spec.ts ✅

### Root Cause
The issue was related to Viem's strict typing system where Ethereum addresses must be typed as `\`0x${string}\`` rather than generic `string` types. The test mocks were using regular strings for contract addresses, causing TypeScript compilation failures.

### Impact
- Fixed all wallet test failures without changing any production code
- Maintained type safety and proper Viem integration
- Ensured test robustness by using proper type definitions