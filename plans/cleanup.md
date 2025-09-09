# Logging Cleanup Plan

## Overview

Remove inline logging at function start/end and replace with log decorator usage. Inline logging should only remain when data is not available to the decorator.

## Tasks

### Task 1: Clean up src/api, src/auth, src/chain-monitor directories

**Search patterns to find:**

- `logger.log()`, `logger.info()`, `logger.debug()` at function start/end
- Function entry/exit logging that duplicates decorator functionality
- Generic operation logging that should use decorators

**Files to process:**

- `src/api/**/*.ts`
- `src/auth/**/*.ts` (if exists)
- `src/chain-monitor/**/*.ts`

**Subtasks:**
- ☐ Search for remaining inline logging patterns across the assigned directories
- ☐ Convert inline logging to decorator-based logging in identified files  
- ☐ Verify all controller and service methods use proper @LogOperation decorators
- ☐ Verify that internally caught throws are also getting logged
- ☐ Fix any tests that break due to logging changes

**Action:** Remove redundant logging, ensure decorators are properly applied

### Task 2: Clean up src/common directory

**Search patterns to find:**

- Inline logging in utility functions
- Start/end function logging in common services
- Redundant error logging that decorators handle

**Files to process:**

- `src/common/**/*.ts`

**Subtasks:**
- ☐ Search for remaining inline logging patterns across the assigned directories
- ☐ Convert inline logging to decorator-based logging in identified files  
- ☐ Verify all controller and service methods use proper @LogOperation decorators
- ☐ Verify that internally caught throws are also getting logged
- ☐ Fix any tests that break due to logging changes

**Action:** Remove redundant logging while preserving business logic logging

### Task 3: Clean up src/fulfillment-estimate, src/flags, src/intent\* directories

**Search patterns to find:**

- Function entry/exit logs
- Parameter logging at function start (should be in decorator)
- Result logging at function end (should be in decorator)

**Files to process:**

- `src/fulfillment-estimate/**/*.ts`
- `src/flags/**/*.ts`
- `src/intent/**/*.ts`
- `src/intent-initiation/**/*.ts`

**Subtasks:**
- ☐ Search for remaining inline logging patterns across the assigned directories
- ☐ Convert inline logging to decorator-based logging in identified files  
- ☐ Verify all controller and service methods use proper @LogOperation decorators
- ☐ Verify that internally caught throws are also getting logged
- ☐ Fix any tests that break due to logging changes

**Action:** Remove redundant logging, verify decorator coverage

### Task 4: Clean up src/intervals, src/liquidity-manager, src/prover directories

**Search patterns to find:**

- Method start/end logging
- Parameter dumping at function entry
- Success/failure logging at function exit

**Files to process:**

- `src/intervals/**/*.ts`
- `src/liquidity-manager/**/*.ts`
- `src/prover/**/*.ts`

**Subtasks:**
- ☐ Search for remaining inline logging patterns across the assigned directories
- ☐ Convert inline logging to decorator-based logging in identified files  
- ☐ Verify all controller and service methods use proper @LogOperation decorators
- ☐ Verify that internally caught throws are also getting logged
- ☐ Fix any tests that break due to logging changes

**Action:** Remove redundant logging, ensure proper decorator usage

### Task 5: Clean up src/request-signing, src/sign, src/solver\*, src/watch directories

**Search patterns to find:**

- Function boundary logging
- Redundant parameter/result logging
- Generic operation start/end messages

**Files to process:**

- `src/request-signing/**/*.ts`
- `src/sign/**/*.ts`
- `src/solver/**/*.ts`
- `src/solver-registration/**/*.ts`
- `src/watch/**/*.ts`

**Subtasks:**
- ☐ Search for remaining inline logging patterns across the assigned directories
- ☐ Convert inline logging to decorator-based logging in identified files  
- ☐ Verify all controller and service methods use proper @LogOperation decorators
- ☐ Verify that internally caught throws are also getting logged
- ☐ Fix any tests that break due to logging changes

**Action:** Remove redundant logging, verify decorator implementation

## Example: Before and After

### Before (Remove this type of logging):
```typescript
async someMethod(param1: string, param2: number) {
  this.logger.log('Starting someMethod with params:', { param1, param2 });
  
  try {
    const result = await this.processData(param1, param2);
    this.logger.log('someMethod completed successfully:', result);
    return result;
  } catch (error) {
    this.logger.error('someMethod failed:', error);
    throw error;
  }
}
```

### After (Use decorator instead):
```typescript
@LogOperation()
async someMethod(param1: string, param2: number) {
  // Only keep business logic logging that decorator can't capture
  const result = await this.processData(param1, param2);
  return result;
}
```

## Guidelines for Each Task

### Keep inline logging when:

- Data is computed mid-function and not available to decorator
- Conditional logging based on runtime state
- Loop iteration details
- Exception details that decorators don't capture
- Business logic milestones (not function boundaries)

### Convert to decorator-based logging when:

- Function entry messages
- Function exit messages
- Parameter logging at start (decorator handles this)
- Result logging at end (decorator handles this)
- Generic "starting operation X" / "completed operation X" messages

**Rule:** Any inline logging that can be replaced with decorator-based logging should be converted to use decorators. Otherwise, leave them as is.

### Verification steps for each task:

1. Search for remaining function boundary logging
2. Verify decorators are properly applied
3. Run tests to ensure functionality is preserved
4. Check that important business logic logging remains