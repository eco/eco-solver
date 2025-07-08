# Intent Analysis - Reusable Database Queries

## Quick Reference for Intent Creator Analysis

### Database Connection

- **Database**: `eco-solver-prod`
- **Collection**: `intentsourcemodels`

### Query Template for Last 24 Hours Analysis

#### Step 1: Calculate 24h ago timestamp

```bash
# Get UTC timestamp for exactly 24 hours ago
date -v-1d -u +"%Y-%m-%dT%H:%M:%S.000Z"
```

#### Step 2: Single Optimized Aggregation Query

```javascript
// MongoDB Aggregation Pipeline - Single Query Solution
db.intentsourcemodels.aggregate([
  // Filter for last 24 hours
  {
    $match: {
      createdAt: { $gte: { $date: 'REPLACE_WITH_24H_AGO_TIMESTAMP' } },
    },
  },

  // Unwind reward tokens array to process each token separately
  { $unwind: '$intent.reward.tokens' },

  // Group by creator and token to get per-token totals
  {
    $group: {
      _id: {
        creator: '$intent.reward.creator',
        tokenAddress: '$intent.reward.tokens.token',
      },
      totalAmount: { $sum: '$intent.reward.tokens.amount' },
      intentCount: { $sum: 1 },
    },
  },

  // Group by creator to get final totals with token breakdown
  {
    $group: {
      _id: '$_id.creator',
      totalRewardAmount: { $sum: '$totalAmount' },
      intentCount: { $sum: '$intentCount' },
      tokenBreakdown: {
        $push: {
          token: '$_id.tokenAddress',
          amount: '$totalAmount',
        },
      },
    },
  },

  // Sort by total reward amount descending
  { $sort: { totalRewardAmount: -1 } },

  // Limit to top 20
  { $limit: 20 },

  // Clean up projection
  {
    $project: {
      creator: '$_id',
      totalRewardAmount: 1,
      intentCount: 1,
      tokenBreakdown: 1,
      _id: 0,
    },
  },
])
```

#### MCP MongoDB Tool Command Format

```javascript
mcp__mongodb -
  prod__aggregate({
    database: 'eco-solver-prod',
    collection: 'intentsourcemodels',
    pipeline: [
      { $match: { createdAt: { $gte: { $date: '2025-06-30T15:05:54.000Z' } } } },
      { $unwind: '$intent.reward.tokens' },
      {
        $group: {
          _id: { creator: '$intent.reward.creator', tokenAddress: '$intent.reward.tokens.token' },
          totalAmount: { $sum: '$intent.reward.tokens.amount' },
          intentCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.creator',
          totalRewardAmount: { $sum: '$totalAmount' },
          intentCount: { $sum: '$intentCount' },
          tokenBreakdown: { $push: { token: '$_id.tokenAddress', amount: '$totalAmount' } },
        },
      },
      { $sort: { totalRewardAmount: -1 } },
      { $limit: 20 },
      {
        $project: {
          creator: '$_id',
          totalRewardAmount: 1,
          intentCount: 1,
          tokenBreakdown: 1,
          _id: 0,
        },
      },
    ],
  })
```

## Query Optimization Notes

### Performance Benefits

- **Single Query**: Combines filtering, grouping, and sorting in one operation
- **Efficient Indexing**: Uses `createdAt` index for time-based filtering
- **Token Breakdown**: Provides detailed token analysis without additional queries
- **Memory Efficient**: Limits result set to top 20 early in pipeline

### Data Structure Insights

- Path to creator: `intent.reward.creator`
- Path to reward tokens: `intent.reward.tokens` (array)
- Each token has: `token` (address) and `amount` (number)
- Document structure includes nested `intent.reward` object

### Alternative Queries

#### Simple Creator Totals (if token breakdown not needed)

```javascript
;[
  { $match: { createdAt: { $gte: { $date: 'TIMESTAMP' } } } },
  { $unwind: '$intent.reward.tokens' },
  {
    $group: {
      _id: '$intent.reward.creator',
      totalRewardAmount: { $sum: '$intent.reward.tokens.amount' },
      intentCount: { $sum: 1 },
    },
  },
  { $sort: { totalRewardAmount: -1 } },
  { $limit: 20 },
]
```

#### Get Specific Creator Details

```javascript
;[
  {
    $match: {
      'intent.reward.creator': '0xCREATOR_ADDRESS',
      createdAt: { $gte: { $date: 'TIMESTAMP' } },
    },
  },
  { $unwind: '$intent.reward.tokens' },
  {
    $group: {
      _id: '$intent.reward.tokens.token',
      totalAmount: { $sum: '$intent.reward.tokens.amount' },
      count: { $sum: 1 },
    },
  },
]
```

## File Outputs

### CSV Structure for Google Sheets

```csv
Rank,Creator Address,Total Reward Amount,Intent Count,Top Token Used,Top Token Amount
```

### Process Summary

1. **One DB Query**: Single aggregation pipeline gets all needed data
2. **Token Analysis**: Includes breakdown by token type per creator
3. **Ready for Sheets**: CSV format with rankings and key metrics
4. **Reusable**: Template timestamps can be easily updated

## Usage Instructions

1. Replace `REPLACE_WITH_24H_AGO_TIMESTAMP` with actual timestamp from step 1
2. Execute the aggregation query
3. Process results into CSV format
4. Import CSV into Google Sheets

## Query Execution Time

- **Typical execution**: ~2-5 seconds for 24h data
- **Result size**: Top 20 creators with token breakdown
- **Memory usage**: Optimized with early limiting and efficient grouping

## Last Execution Results

- **Date**: 2025-07-01
- **Records analyzed**: ~703 intents in last 24h
- **Top creator**: 0xAE786cB1fb10e6f957F7a0944621F25313bEBFfc (1.93T reward amount)
- **Files created**: `intent-creators-top20-optimized.csv`
