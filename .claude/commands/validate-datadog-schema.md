---
name: validate-datadog-schema
description: Validate that Datadog logging operations match the current database schema fields and business logic. Detects missing or outdated logging attributes when schemas change.
---

# Schema-Logging Validation Command

This command validates that all Datadog logging operations are synchronized with the current database schemas and business logic. It detects when database schema changes are not reflected in logging code.

## What This Command Does

1. **Schema Analysis**: Scans all database schema files for field changes
2. **Logging Code Review**: Analyzes EcoLogMessage usage across the codebase
3. **Gap Detection**: Identifies missing or outdated logging attributes
4. **Compliance Check**: Validates against Datadog best practices and size limits

## Execution

Use the specialized Datadog logging agent to perform a comprehensive validation:

````markdown
@datadog-logging-specialist

Please perform a comprehensive schema-logging validation:

## Task: Database Schema vs Datadog Logging Validation

### 1. Schema Analysis

Analyze these critical schema files for all business attributes:

- `src/intent/schemas/intent-data.schema.ts`
- `src/quote/schemas/quote-intent.schema.ts`
- `src/liquidity-manager/schemas/rebalance.schema.ts`
- `src/liquidity-manager/schemas/rebalance-quote-rejection.schema.ts`
- `src/liquidity-manager/schemas/rebalance-token.schema.ts`

Extract all fields that should be available for Datadog analytics:

- High-cardinality identifiers (intent_hash, quote_id, rebalance_id, wallet_address, etc.)
- Medium-cardinality filters (strategy, chain_id, token_address, status, etc.)
- Financial metrics (amounts, slippage, balances, etc.)
- Operational context (timestamps, execution_type, rejection_reason, etc.)

### 2. Logging Implementation Review

Search and analyze current EcoLogMessage usage patterns:

```bash
# Find all EcoLogMessage usage
grep -r "EcoLogMessage\." --include="*.ts" src/

# Focus on these critical areas:
src/intent/
src/quote/
src/liquidity-manager/
src/intent-processor/
src/bullmq/processors/
```
````

### 3. Gap Analysis

Compare schema fields vs logging implementation:

- **Missing Fields**: Schema fields not captured in logging
- **Outdated Fields**: Logging references to removed schema fields
- **Incorrect Types**: Type mismatches between schema and logging
- **Datadog Compliance**: Size limits, reserved attributes, faceting strategy

### 4. Validation Report

Provide a structured report with the exact success indicator:

**CRITICAL**: If all schema fields are properly captured in logging, start your report with:

```
✅ **Synchronized Fields**: Schema fields properly captured in logging
```

If there are issues, provide detailed analysis:

#### Schema Coverage Analysis

- **Intent Operations**: X/Y fields captured (X%)
- **Quote Operations**: X/Y fields captured (X%)
- **Rebalance Operations**: X/Y fields captured (X%)
- **Quote Rejections**: X/Y fields captured (X%)

#### Issues Found (if any)

1. **Missing High-Cardinality Fields**
   - `intent_hash` not captured in intent creation logs
   - `wallet_address` missing from rebalance error logs
2. **Outdated Field References**
   - `intent_id` used instead of `intent_hash`
   - Removed `routeHash` still referenced in quotes
3. **Datadog Compliance Issues**
   - Log messages exceeding 25KB size limit
   - Reserved attribute conflicts
   - Poor faceting strategy

#### Recommended Actions (if issues found)

1. **Immediate Fixes** (Critical)
   - Add missing intent_hash to all intent operations
   - Update rebalance logging to include wallet_address
2. **Schema Alignment** (High Priority)
   - Replace intent_id references with intent_hash
   - Add strategy field to all liquidity operations
3. **Datadog Optimization** (Medium Priority)
   - Implement size validation for large context objects
   - Move high-cardinality fields to eco namespace

### 5. Implementation Guidelines

For each identified gap, provide:

- Specific file locations that need updates
- Before/after code examples
- Datadog best practice compliance
- Testing recommendations

Focus on ensuring our Datadog logging captures all business-critical schema fields for comprehensive analytics and observability.

```

## Expected Output

The command will generate a comprehensive validation report. **CRITICAL SUCCESS INDICATOR:**

If all schema fields are properly synchronized with logging, the report MUST include this exact line:
```

✅ **Synchronized Fields**: Schema fields properly captured in logging

```

Other status indicators:
- ❌ **Missing Fields**: Schema attributes not reflected in logs
- ⚠️ **Outdated References**: Logging code referencing removed schema fields
- 🔧 **Compliance Issues**: Datadog best practice violations

**Note**: The GitHub Action will fail if the success indicator is not present in the validation output.

## Usage Context

Run this command:
- **After schema changes**: When database models are modified
- **Before releases**: As part of CI/CD validation
- **During development**: When adding new logging operations
- **Schema audits**: Periodic validation of logging completeness

## Integration

This command is designed to be called by:
- GitHub Actions on schema file changes
- Pre-commit hooks for logging file modifications
- Manual validation during development
- Release pipeline quality gates
```
