# Quick Start Guide

## Using the Transaction Analyzer Skill

### Method 1: Through Claude Code (Recommended)

Simply ask Claude to analyze your logs:

```
Analyze the transaction logs in my-transaction.json
```

or

```
/skill transaction-analyzer
```

Claude will automatically:
1. Ask for the log file path (if not provided)
2. Run the analysis
3. Present comprehensive findings with metrics and recommendations

### Method 2: Direct Script Usage

Run the Python script directly for JSON output:

```bash
python3 .claude/skills/transaction-analyzer/analyze.py path/to/your/log.json
```

This outputs structured JSON with all metrics.

### Try the Example

Test with the included example log:

```bash
# Via Claude Code
Analyze .claude/skills/transaction-analyzer/example-base-to-optimism-usdc-transfer.json

# Or directly
python3 .claude/skills/transaction-analyzer/analyze.py \
  .claude/skills/transaction-analyzer/example-base-to-optimism-usdc-transfer.json
```

## What You'll Get

The analysis provides:

1. **📊 Executive Summary** - Duration, amounts, fees, success rate
2. **💰 Transaction Economics** - Detailed fee breakdown and token info
3. **⏱️ Performance Breakdown** - Time spent in each phase
4. **🔍 Bottleneck Analysis** - Critical path and slowest operations
5. **✅ Validation Results** - All checks performed
6. **🎯 Optimization Recommendations** - Ranked by impact with time savings
7. **📈 Business Insights** - Competitiveness, UX, reliability

## Expected Log Format

Your log file should be **newline-delimited JSON** (NDJSON) where each line contains an event:

```json
{"level":30,"time":1760994606380,"message":"quote_generation started","operation":{"type":"quote_generation","status":"started"}}
{"level":30,"time":1760994606948,"message":"quote_generation completed","operation":{"type":"quote_generation","status":"completed","duration_ms":568.66}}
```

Key fields used:
- `time`: Unix timestamp in milliseconds
- `message`: Event description
- `operation.type`: Operation type (quote_generation, intent_fulfillment, etc.)
- `operation.status`: started/completed/failed
- `operation.duration_ms`: Duration for completed operations
- `eco`: Transaction metadata (chains, amounts, etc.)

## Common Use Cases

### After a Production Transaction
```
Analyze production-logs/transaction-2025-10-20-abc123.json
```

### Comparing Performance
```
Compare these two transaction logs:
1. .claude/skills/transaction-analyzer/example-base-to-optimism-usdc-transfer.json
2. logs/recent-transaction.json
```

### Finding Bottlenecks
```
What are the main bottlenecks in transaction-xyz.json?
```

### Optimization Review
```
Analyze transaction-before-optimization.json and suggest improvements
```

## Tips

- **Focus on critical path**: The skill identifies which operations are blocking
- **Look for >10s operations**: These are usually worth optimizing
- **Check validation passes**: All should pass on first attempt for good UX
- **Compare to benchmarks**: The skill uses industry benchmarks to assess performance
- **Prioritize by impact**: Recommendations are ranked by potential time savings

## Next Steps

After analysis:
1. Review the bottleneck analysis
2. Focus on HIGH impact optimizations first
3. Compare before/after logs to measure improvements
4. Monitor trends across multiple transactions

## Need Help?

See the full [README.md](README.md) for detailed documentation.
