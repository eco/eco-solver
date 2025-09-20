# Intents Module

## Overview

The Intents module manages the persistence and lifecycle of blockchain intents. It provides database operations, schema definitions, status tracking, and conversion utilities for handling intent data across the system.

## Architecture

### Core Components

#### IntentsService
Main service for intent database operations.

**Responsibilities:**
- CRUD operations for intents
- Status management
- Query operations
- Data conversion

**Key Methods:**
- `create(intent: Intent)`: Create new intent
- `findByHash(intentHash: string)`: Find intent by hash
- `updateStatus(intentHash: string, status: IntentStatus)`: Update status
- `findPendingIntents()`: Get intents awaiting processing
- `findByChain(chainId: bigint)`: Find intents for specific chain

#### Intent Schema
Mongoose schema for MongoDB storage.

```typescript
const IntentSchema = new Schema({
  intentHash: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  reward: {
    prover: { type: String, required: true },
    creator: { type: String, required: true },
    deadline: { type: String, required: true }, // BigInt as string
    nativeAmount: { type: String, required: true }, // BigInt as string
    tokens: [{
      amount: { type: String, required: true }, // BigInt as string
      token: { type: String, required: true }
    }]
  },
  route: {
    source: { type: String, required: true }, // BigInt as string
    destination: { type: String, required: true }, // BigInt as string
    salt: { type: String, required: true },
    portal: { type: String, required: true },
    calls: [{
      data: { type: String, required: true },
      target: { type: String, required: true },
      value: { type: String, required: true } // BigInt as string
    }],
    tokens: [{
      amount: { type: String, required: true }, // BigInt as string
      token: { type: String, required: true }
    }]
  },
  status: {
    type: String,
    enum: Object.values(IntentStatus),
    default: IntentStatus.PENDING,
    index: true
  },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
    completedAt: { type: Date },
    failureReason: { type: String },
    transactionHash: { type: String },
    strategy: { type: String },
    attempts: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});
```

## Intent Lifecycle

### Status Flow
```
PENDING → VALIDATING → EXECUTING → FULFILLED
           ↓              ↓
        FAILED         FAILED
```

### Status Definitions

#### IntentStatus Enum
```typescript
enum IntentStatus {
  PENDING = 'PENDING',           // Initial state
  VALIDATING = 'VALIDATING',     // Being validated
  EXECUTING = 'EXECUTING',       // Being executed
  FULFILLED = 'FULFILLED',       // Successfully executed
  FAILED = 'FAILED'              // Execution failed
}
```

### Status Transitions
1. **PENDING**: Intent created and stored
2. **VALIDATING**: Picked up by fulfillment processor
3. **EXECUTING**: Being executed on blockchain
4. **FULFILLED**: Successfully executed
5. **FAILED**: Validation or execution failed

## Data Conversion

### IntentConverter Utility
Handles conversion between different data formats.

#### Database to Domain
```typescript
static toDomain(dbIntent: IntentDocument): Intent {
  return {
    intentHash: dbIntent.intentHash as Hex,
    reward: {
      prover: dbIntent.reward.prover as Address,
      creator: dbIntent.reward.creator as Address,
      deadline: BigInt(dbIntent.reward.deadline),
      nativeAmount: BigInt(dbIntent.reward.nativeAmount),
      tokens: dbIntent.reward.tokens.map(t => ({
        amount: BigInt(t.amount),
        token: t.token as Address
      }))
    },
    route: {
      source: BigInt(dbIntent.route.source),
      destination: BigInt(dbIntent.route.destination),
      salt: dbIntent.route.salt as Hex,
      portal: dbIntent.route.portal as Address,
      calls: dbIntent.route.calls.map(c => ({
        data: c.data as Hex,
        target: c.target as Address,
        value: BigInt(c.value)
      })),
      tokens: dbIntent.route.tokens.map(t => ({
        amount: BigInt(t.amount),
        token: t.token as Address
      }))
    },
    status: dbIntent.status,
    metadata: dbIntent.metadata
  };
}
```

#### Domain to Database
```typescript
static toDatabase(intent: Intent): IntentDbModel {
  return {
    intentHash: intent.intentHash,
    reward: {
      prover: intent.reward.prover,
      creator: intent.reward.creator,
      deadline: intent.reward.deadline.toString(),
      nativeAmount: intent.reward.nativeAmount.toString(),
      tokens: intent.reward.tokens.map(t => ({
        amount: t.amount.toString(),
        token: t.token
      }))
    },
    route: {
      source: intent.route.source.toString(),
      destination: intent.route.destination.toString(),
      salt: intent.route.salt,
      portal: intent.route.portal,
      calls: intent.route.calls.map(c => ({
        data: c.data,
        target: c.target,
        value: c.value.toString()
      })),
      tokens: intent.route.tokens.map(t => ({
        amount: t.amount.toString(),
        token: t.token
      }))
    },
    status: intent.status,
    metadata: intent.metadata
  };
}
```

## Query Operations

### Common Queries

#### Find by Status
```typescript
async findByStatus(status: IntentStatus): Promise<Intent[]> {
  const intents = await this.intentModel
    .find({ status })
    .sort({ 'metadata.createdAt': -1 })
    .exec();
  
  return intents.map(IntentConverter.toDomain);
}
```

#### Find by Chain
```typescript
async findByChain(
  chainId: bigint, 
  type: 'source' | 'destination'
): Promise<Intent[]> {
  const field = type === 'source' ? 'route.source' : 'route.destination';
  
  const intents = await this.intentModel
    .find({ [field]: chainId.toString() })
    .exec();
  
  return intents.map(IntentConverter.toDomain);
}
```

#### Find Expired
```typescript
async findExpiredIntents(): Promise<Intent[]> {
  const now = BigInt(Date.now() / 1000);
  
  const intents = await this.intentModel
    .find({
      status: { $in: [IntentStatus.PENDING, IntentStatus.VALIDATED] },
      'reward.deadline': { $lt: now.toString() }
    })
    .exec();
  
  return intents.map(IntentConverter.toDomain);
}
```

#### Aggregations
```typescript
async getStatsByChain(): Promise<ChainStats[]> {
  return this.intentModel.aggregate([
    {
      $group: {
        _id: '$route.source',
        count: { $sum: 1 },
        totalValue: { $sum: { $toLong: '$reward.nativeAmount' } },
        statuses: {
          $push: '$status'
        }
      }
    },
    {
      $project: {
        chainId: '$_id',
        count: 1,
        totalValue: 1,
        completed: {
          $size: {
            $filter: {
              input: '$statuses',
              cond: { $eq: ['$$this', 'completed'] }
            }
          }
        }
      }
    }
  ]);
}
```

## Indexes and Performance

### Index Strategy
```typescript
// Compound indexes
IntentSchema.index({ status: 1, 'metadata.createdAt': -1 });
IntentSchema.index({ 'route.source': 1, status: 1 });
IntentSchema.index({ 'route.destination': 1, status: 1 });
IntentSchema.index({ 'reward.creator': 1, 'metadata.createdAt': -1 });

// TTL index for cleanup
IntentSchema.index(
  { 'metadata.completedAt': 1 }, 
  { expireAfterSeconds: 86400 * 30 } // 30 days
);
```

### Query Optimization
- Use projection to limit returned fields
- Implement pagination for large result sets
- Use aggregation pipeline for complex queries
- Cache frequently accessed intents

## Integration Points

### With FulfillmentService
```typescript
// Create intent
const dbIntent = await intentsService.create(intent);

// Update status during processing
await intentsService.updateStatus(
  intent.intentHash,
  IntentStatus.VALIDATING
);
```

### With Queue System
```typescript
// Find pending intents for reprocessing
const pendingIntents = await intentsService.findByStatus(
  IntentStatus.PENDING
);

// Queue for processing
for (const intent of pendingIntents) {
  await queueService.addIntentToFulfillmentQueue(
    intent,
    'standard'
  );
}
```

### With API Module
```typescript
// Get intent details for API response
const intent = await intentsService.findByHash(intentHash);
if (!intent) {
  throw new NotFoundException('Intent not found');
}
```

## Data Management

### Cleanup Strategies

1. **TTL Indexes**: Automatic deletion of old completed intents
2. **Archival Process**: Move old intents to archive collection
3. **Soft Deletes**: Mark as deleted without removal
4. **Batch Cleanup**: Scheduled jobs for maintenance

### Backup and Recovery
```typescript
// Export intents
async exportIntents(filter: any): Promise<void> {
  const intents = await this.intentModel.find(filter);
  await fs.writeFile(
    'intents-backup.json',
    JSON.stringify(intents, null, 2)
  );
}

// Import intents
async importIntents(file: string): Promise<void> {
  const data = await fs.readFile(file, 'utf-8');
  const intents = JSON.parse(data);
  await this.intentModel.insertMany(intents);
}
```

## Monitoring

### Metrics
- Intent creation rate
- Status distribution
- Processing duration
- Failure reasons
- Chain distribution

### Health Checks
```typescript
async checkHealth(): Promise<HealthStatus> {
  try {
    // Check database connection
    await this.intentModel.db.admin().ping();
    
    // Check recent activity
    const recentIntent = await this.intentModel
      .findOne()
      .sort({ 'metadata.createdAt': -1 });
    
    const lastActivity = recentIntent?.metadata.createdAt;
    const isStale = Date.now() - lastActivity > 3600000; // 1 hour
    
    return {
      healthy: !isStale,
      lastActivity,
      message: isStale ? 'No recent activity' : 'Healthy'
    };
  } catch (error) {
    return {
      healthy: false,
      message: error.message
    };
  }
}
```

## Best Practices

### Data Integrity
- Use transactions for multi-document updates
- Implement optimistic locking with version fields
- Validate data before persistence
- Handle concurrent updates gracefully

### Performance
- Use appropriate indexes
- Limit query result size
- Implement caching for hot data
- Use aggregation pipelines efficiently

### Security
- Sanitize user input
- Use parameterized queries
- Implement access control
- Audit sensitive operations

## Troubleshooting

### Common Issues

1. **Duplicate Intent Hash**
   - Check uniqueness constraint
   - Implement retry logic
   - Use idempotency keys

2. **Status Update Conflicts**
   - Use atomic operations
   - Implement version checking
   - Handle race conditions

3. **Query Performance**
   - Review index usage
   - Analyze query execution plans
   - Optimize aggregation pipelines

4. **Data Conversion Errors**
   - Validate BigInt strings
   - Check address formats
   - Handle null values

### Debugging
```typescript
// Enable MongoDB query logging
mongoose.set('debug', true);

// Log query execution time
IntentSchema.pre('find', function() {
  this.startTime = Date.now();
});

IntentSchema.post('find', function() {
  console.log(`Query took ${Date.now() - this.startTime}ms`);
});
```