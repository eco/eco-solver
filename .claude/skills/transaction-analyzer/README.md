# Transaction Analyzer Skill

A Claude Code skill for analyzing cross-chain transaction logs from the eco-solver system. This skill provides comprehensive data science insights into transaction performance, bottlenecks, and optimization opportunities.

## Overview

This skill analyzes JSON log files from the eco-solver system and automatically detects which part of the transaction lifecycle is present:

**Supported Log Types:**
- **Quote Only** - Just quote generation and validation (typical: ~0.6s)
- **Fulfillment Only** - Intent processing and fulfillment from on-chain detection (typical: 15-30s)
- **Full Lifecycle** - Complete flow including user wait time between quote and on-chain transaction

The analyzer automatically detects the log type and adapts its analysis accordingly.

## Files

- **`skill.md`** - Skill metadata and description
- **`prompt.md`** - Main prompt that guides the analysis
- **`analyze.py`** - Python script that extracts metrics from logs
- **`example-base-to-optimism-usdc-transfer.json`** - Example log file (Base → Optimism USDC transfer)
- **`README.md`** - This file

## Usage

### In Claude Code

Simply invoke the skill:
```
/skill transaction-analyzer
```

Or reference it in conversation:
```
Analyze the transaction logs in logs/transaction-123.json
```

Claude will automatically use this skill to provide comprehensive analysis.

### Manual Usage

You can also run the analysis script directly:

```bash
python3 .claude/skills/transaction-analyzer/analyze.py path/to/log-file.json
```

This outputs a JSON structure with all extracted metrics.

## What It Analyzes

### 1. Executive Summary
- Total duration (seconds)
- Transaction amounts and chains
- Fee percentage
- Success rate

### 2. Transaction Economics
- Source and destination amounts
- Token addresses
- Solver fees (amount and percentage)
- Gas overhead estimates

### 3. Performance Breakdown
- Quote generation time
- Blockchain confirmation wait
- Intent processing duration
- Feasibility check time
- Fulfillment execution time

### 4. Bottleneck Analysis
- Identifies longest operations
- Calculates percentage of total time
- Provides status indicators (✅/⚠️/🔴)
- Ranks optimization opportunities

### 5. Validation Results
- All validation checks performed
- Pass/fail status for each
- Balance sufficiency
- Chain compatibility

### 6. Chain Activity
- Number of balance queries
- Chains involved (with IDs)
- Transaction and intent hashes
- Block numbers

### 7. Error Analysis
- Failed operations
- Retry attempts
- Success rates on critical path

### 8. Optimization Recommendations
Ranked by impact:
- High impact: Major bottlenecks (>10s savings potential)
- Medium impact: Incremental improvements (2-10s savings)
- Low impact: Minor optimizations (<2s savings)

### 9. Business Insights
- Fee competitiveness vs market
- User experience assessment
- System reliability indicators
- Resource efficiency observations

## Performance Benchmarks

The skill uses these benchmarks for interpretation:

### Timing
- ✅ Quote generation <1s = Excellent
- ⚠️ Feasibility check >10s = Needs optimization
- ✅ Blockchain wait 20-30s = Normal (network constraint)
- ✅ Total time <2 min = Good UX
- 🔴 Total time >5 min = Poor UX

### Fees
- ✅ 2-3% = Excellent
- ✅ 3-5% = Competitive
- ⚠️ 5-7% = High but acceptable
- 🔴 >7% = Uncompetitive

### Reliability
- ✅ Zero retries = Robust validation
- ✅ All validations pass = Well designed
- ⚠️ 1-2 retries = Minor issues
- 🔴 >3 retries = System issues

## Example Output

```
📊 Executive Summary
- Total Duration: 169.78 seconds (~2.8 minutes)
- Transaction: 0.78 USDC (Base) → 0.75 USDC (Optimism)
- Fee: 0.03 USDC (4%)
- Success Rate: 100%

⏱️ Performance Breakdown
Phase 1: Quote Generation (568ms) ✅
Phase 2: Blockchain Confirmation (26.88s) ⚠️
Phase 3: Intent Processing (65.30s) 🔴
  - Intent feasibility check: 18.58s ← BOTTLENECK
Phase 4: Fulfillment (1.51s) ✅

🎯 Top 3 Optimization Opportunities
1. HIGH IMPACT: Reduce feasibility check 18.58s → 5s (save ~13s, 7.6%)
2. MEDIUM IMPACT: Optimize processor scheduling (save ~20-30s, ~15%)
3. LOW IMPACT: Reduce balance check redundancy (save ~1-2s, <1%)

Potential Total Improvement: 169.78s → ~120s (30% faster)
```

## Log File Format

Expected format: Newline-delimited JSON (NDJSON) where each line is a JSON object with:

```json
{
  "level": 30,
  "time": 1760994606380,
  "message": "quote_generation started",
  "operation": {
    "type": "quote_generation",
    "status": "started",
    "duration_ms": 568.66
  },
  "eco": {
    "source_chain_id": "8453",
    "destination_chain_id": "10"
  }
}
```

## Example Analysis

To see the skill in action, analyze the included example:

```bash
python3 .claude/skills/transaction-analyzer/analyze.py \
  .claude/skills/transaction-analyzer/example-base-to-optimism-usdc-transfer.json
```

This example shows a 0.78 USDC transfer from Base to Optimism with:
- 4% fee (0.03 USDC)
- 169.78 second total duration
- 18.58 second feasibility check bottleneck
- 100% success rate

## Integration

This skill is automatically available in Claude Code when placed in `.claude/skills/`.

To use it:
1. Ensure the directory structure is intact
2. Make sure `analyze.py` is executable (`chmod +x analyze.py`)
3. Invoke via `/skill transaction-analyzer` or natural language

## Customization

You can customize the analysis by:
- Modifying `prompt.md` to change output format or focus areas
- Extending `analyze.py` to extract additional metrics
- Adjusting benchmarks in `prompt.md` for your specific use case
- Adding more example files for different transaction types

## Requirements

- Python 3.6+
- No external dependencies (uses only stdlib)

## License

Internal tool for eco-solver development.
