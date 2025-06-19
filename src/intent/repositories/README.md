# Intent Repositories

This directory contains the repository pattern implementations for the Intent module, providing clean data access layer abstractions for database operations.

## IntentSourceRepository

The `IntentSourceRepository` provides methods for managing `IntentSourceModel` documents, including:

### Key Methods

- `findSelfFulfilledByStatus(status)` - Find all intents that we fulfilled ourselves with a specific status
- `findByIntentHash(hash)` - Find an intent by its hash
- `updateByIntentHash(hash, updates)` - Update an intent by its hash
- `getSelfFulfilledStats()` - Get statistics about self-fulfilled intents

### Example Usage

```typescript
// Find all self-fulfilled intents with SOLVED status
const solvedIntents = await intentSourceRepository.findSelfFulfilledByStatus('SOLVED')

// Find all self-fulfilled intents with WITHDRAWN status
const withdrawnIntents = await intentSourceRepository.findSelfFulfilledByStatus('WITHDRAWN')

// Get statistics about self-fulfilled intents
const stats = await intentSourceRepository.getSelfFulfilledStats()
console.log(`Total self-fulfilled: ${stats.totalSelfFulfilled}`)
console.log(`By status:`, stats.byStatus)
```

## WithdrawalRepository

The `WithdrawalRepository` provides methods for managing `WithdrawalModel` documents, focusing on model fields rather than event data.

### Key Methods

- `exists(intentHash)` - Check if a withdrawal exists by intent hash
- `findByIntentHash(hash)` - Find withdrawals by intent hash
- `findByRecipient(address)` - Find withdrawals by recipient address

### Design Principles

- Repositories only operate on model fields, not nested event data
- Use intent hash for primary lookups rather than transaction details
- Maintain clean separation between data access and business logic
