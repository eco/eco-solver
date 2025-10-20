---
name: Transaction Analyzer
description: Analyze cross-chain transaction logs from eco-solver to extract performance metrics, identify bottlenecks, and provide optimization recommendations. Use when analyzing JSON log files from quote generation to fulfillment lifecycle.
allowed-tools: Read, Bash, Write
---

# Transaction Analyzer

Analyze cross-chain transaction logs from the eco-solver system and provide comprehensive data science insights about performance, bottlenecks, and optimization opportunities.

## What This Skill Does

This skill analyzes JSON log files from the eco-solver system. It automatically detects the log type and adapts analysis:

**Supported Log Types:**

- **Quote Only** - Just quote generation and validation
- **Full Lifecycle** - Complete flow from quote to fulfillment
- **Fulfillment Only** - Intent processing and fulfillment without quote

The skill extracts key metrics, identifies performance bottlenecks, and provides actionable optimization recommendations.

**Key Feature:** For full lifecycle logs, the skill automatically separates **user wait time** (between quote completion and on-chain transaction) from **system processing time**, ensuring accurate performance analysis.

## When to Use This Skill

Use this skill when:

- Analyzing production transaction logs
- Investigating performance issues or slow transactions
- Comparing transaction performance over time
- Identifying optimization opportunities
- Debugging cross-chain transaction failures
- Generating performance reports for stakeholders

## Instructions

### Step 1: Get the Log File Path

If the user hasn't provided a log file path, ask:

```
Please provide the path to the transaction log file (JSON format)
```

### Step 2: Run the Analysis Script

Execute the analysis script located in this skill directory:

```bash
python3 .claude/skills/transaction-analyzer/analyze.py <log-file-path>
```

The script outputs structured JSON containing all extracted metrics.

### Step 3: Present Comprehensive Findings

Organize your analysis into these sections:

#### 1. Executive Summary

- Log type (quote_only, full_lifecycle, fulfillment_only)
- Total duration (in seconds and human-readable format)
- **Effective processing time** (excluding user wait between quote and transaction)
- **User wait time** (time between quote completion and on-chain transaction) - if applicable
- Transaction route (source chain → destination chain)
- Transaction amounts and fees
- Overall success rate
- Key outcome status

**Example (Full Lifecycle):**

```
📊 Executive Summary
- Log Type: Full Lifecycle
- Total Duration: 169.78 seconds (~2.8 minutes)
- Effective Processing Time: 142.90 seconds
- User Wait Time: 26.88 seconds (quote → on-chain transaction)
- Transaction: 0.78 USDC (Base) → 0.75 USDC (Optimism)
- Fee: 0.03 USDC (4%)
- Success Rate: 100% (no retries needed)
```

**Example (Quote Only):**

```
📊 Executive Summary
- Log Type: Quote Only
- Duration: 0.613 seconds
- Transaction: 0.78 USDC (Base) → 0.75 USDC (Optimism)
- Fee: 0.03 USDC (4%)
- All Validations: ✅ Passed
```

#### 2. Transaction Economics

Present in a table format:

| Metric                            | Value               |
| --------------------------------- | ------------------- |
| User Sends (Source Chain)         | Amount + Token      |
| User Receives (Destination Chain) | Amount + Token      |
| Solver Fee                        | Amount + Percentage |
| Gas Overhead Estimate             | Gas units           |
| Source Token Address              | Address             |
| Destination Token Address         | Address             |

#### 3. Performance Breakdown

For each major phase, show duration and status:

**Phase 1: Quote Generation** (target: <1s)

- Total duration
- Sub-operations (validation, balance checks, fee calculation)
- Status: ✅ Optimized / ⚠️ Concern / 🔴 Critical

**Phase 2: Blockchain Confirmation** (network-dependent)

- Wait time for on-chain confirmation
- Block number and transaction hash
- Status indicator

**Phase 3: Intent Processing**

- Intent detection time
- Feasibility check duration (often the bottleneck)
- Token mapping operations
- Status indicator

**Phase 4: Fulfillment**

- Wallet fulfillment time
- Transaction construction time
- Status indicator

#### 4. Bottleneck Analysis

Identify and rank the longest operations:

```
🔍 BOTTLENECK ANALYSIS

Longest Operations:
• Intent Feasibility Check: 18.58s (11% of total) 🔴 CRITICAL
• Blockchain Confirmation: 26.88s (15.8% of total) ⚠️ Network Constraint
• Wallet Fulfillment: 1.51s (0.9% of total) ✅ Efficient
• Quote Generation: 0.57s (0.3% of total) ✅ Excellent
```

Use these indicators:

- ✅ Optimized: <1s or within expected range
- ⚠️ Concern: Needs attention (5-10s)
- 🔴 Critical: Major bottleneck (>10s)

#### 5. Validation Results

List all validation checks with pass/fail status:

- ✅ Supported native transfers
- ✅ Supported prover
- ✅ Supported targets
- ✅ Valid transfer limits
- ✅ Sufficient balance
- ✅ Cross-chain fulfillment validated

#### 6. Chain Activity

- Number of balance queries performed
- Chains queried (with chain IDs and names)
- Wallet addresses involved
- Transaction hashes and block numbers
- Intent hashes

#### 7. Error & Retry Analysis

- Total errors/failures
- Retry attempts on critical path
- Success rate percentage
- Details of any failed jobs (with context)

#### 8. Optimization Recommendations

Rank by impact (High/Medium/Low):

**HIGH IMPACT**: Operations that could save >10 seconds

- Current duration → target duration
- Estimated time savings
- Percentage improvement

**MEDIUM IMPACT**: Operations that could save 2-10 seconds

- Specific recommendations
- Implementation considerations

**LOW IMPACT**: Operations that could save <2 seconds

- Minor optimizations
- Nice-to-have improvements

**Calculate Potential Total Time Reduction:**

```
Current: 169.78s → Optimized: ~120s (30% improvement)
```

#### 9. Business Insights

- **Fee Competitiveness**: Compare to market benchmarks (2-3% excellent, 3-5% competitive)
- **User Experience**: Assess total time vs user expectations (<2 min good, >5 min poor)
- **System Reliability**: Zero retries indicates robust validation
- **Resource Efficiency**: Balance query optimization opportunities

#### 10. Key Data Science Metrics

Summary statistics:

- Latency distribution by phase (percentages)
- Operation counts by type
- Success/failure rates
- Comparison: estimated vs actual fulfillment time

## Performance Benchmarks

Use these benchmarks for interpretation:

### Timing Benchmarks

- ✅ Quote generation <1s = Excellent
- ⚠️ Feasibility check >10s = Needs optimization
- ✅ Blockchain wait 20-30s = Normal (network constraint)
- ✅ Total time <2 min = Good UX
- ⚠️ Total time 2-5 min = Acceptable but improvable
- 🔴 Total time >5 min = Poor UX

### Fee Benchmarks

- ✅ 2-3% = Excellent
- ✅ 3-5% = Competitive
- ⚠️ 5-7% = High but acceptable
- 🔴 >7% = Uncompetitive

### Reliability Benchmarks

- ✅ Zero retries = Robust validation upfront
- ✅ All validations pass first attempt = Well designed system
- ⚠️ 1-2 retries = Minor issues
- 🔴 >3 retries = System reliability issues

## Output Format Requirements

1. Use clear section headers with emoji for visual clarity
2. Present structured data in markdown tables
3. Use status indicators throughout (✅⚠️🔴)
4. Include specific numbers with units (ms, s, %, USDC, ETH, etc.)
5. Provide actionable recommendations ranked by impact
6. Calculate concrete time/cost savings for each optimization
7. Be concise but comprehensive

## Examples

### Example 1: Analyzing a Production Log

**User Request:**

```
Analyze the transaction logs in logs/prod-tx-2025-10-20.json
```

**Your Response:**

1. Run the analysis script on the provided file
2. Extract all metrics from the JSON output
3. Present findings in the structured format above
4. Focus on the TOP 3 bottlenecks
5. Provide specific, quantified optimization recommendations

### Example 2: Comparing Two Transactions

**User Request:**

```
Compare these two transaction logs and tell me which performed better
```

**Your Response:**

1. Analyze both log files
2. Create a side-by-side comparison table
3. Highlight key differences in timing and fees
4. Identify which transaction was more efficient and why

### Example 3: Investigating a Slow Transaction

**User Request:**

```
Why was this transaction so slow? logs/slow-tx.json
```

**Your Response:**

1. Run the analysis focusing on bottlenecks
2. Identify the specific operations that took longest
3. Compare to benchmarks to identify anomalies
4. Provide specific recommendations to address the slowness

## Supporting Files

This skill includes:

- **[analyze.py](analyze.py)** - Python script that extracts metrics from log files
- **[examples/](examples/)** - Example log files
  - **[example-quote.json](examples/example-quote.json)** - Quote generation only (0.61s)
  - **[example-base-to-optimism-usdc-transfer.json](examples/example-base-to-optimism-usdc-transfer.json)** - Intent fulfillment (24.1s)
- **[README.md](README.md)** - Comprehensive documentation
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide for users
- **[INSTALL.md](INSTALL.md)** - Installation summary

## Important Notes

- Focus on **actionable insights**, not just raw data
- Always identify the **TOP 3 optimization opportunities**
- **Quantify improvements**: "Reducing X from 18s to 5s saves ~13s (7.6% improvement)"
- Consider **both technical and business perspectives**
- Highlight any **anomalies or concerning patterns**
- Compare **estimated vs actual times** to assess quote accuracy
- **User wait time is tracked separately**: Time between quote completion and on-chain transaction is not included in system performance metrics

## Testing the Skill

Try analyzing the included examples:

**Quote Generation Only:**

```bash
python3 .claude/skills/transaction-analyzer/analyze.py \
  .claude/skills/transaction-analyzer/examples/example-quote.json
```

Demonstrates:

- 0.613 second quote generation
- All validations passing in <100ms
- Optimal performance benchmark

**Intent Fulfillment:**

```bash
python3 .claude/skills/transaction-analyzer/analyze.py \
  .claude/skills/transaction-analyzer/examples/example-base-to-optimism-usdc-transfer.json
```

Demonstrates:

- 24.1 second total duration
- 15.9 second feasibility check bottleneck (66% of time)
- 1.78 second fulfillment (excellent)
- Clear optimization opportunity identified
