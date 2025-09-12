## How `TxSigningQueueService` Works: A Detailed Explanation

The `TxSigningQueueService` is the core component that prevents nonce collisions by serializing transaction signing and broadcasting operations per wallet and chain combination. Here's a comprehensive breakdown of its implementation:

### Core Concept

The service maintains a **per-key Promise chain** where each key represents a unique `wallet|chainId` combination. Tasks for the same key execute sequentially (FIFO), while tasks for different keys run concurrently.

### Internal Architecture

```typescript
private readonly tails = new Map<string, Promise<void>>()
```

The service uses a `Map` to store "tail" Promises - each tail represents the last scheduled task for a specific wallet/chain combination. New tasks are appended to this tail, creating a chain of sequential operations.

### The `enqueue` Method - Step by Step

Let me break down exactly how the `enqueue` method works:

#### 1. **Key Generation**

```typescript
const key = `${walletAddress.toLowerCase()}|${chainId}`
```

Creates a unique identifier by combining the lowercased wallet address with the chain ID. This ensures all transactions from the same wallet on the same chain share the same queue.

#### 2. **Queue Retrieval**

```typescript
const existingTail = this.tails.get(key) ?? Promise.resolve()
```

Gets the current tail Promise for this key, or creates a resolved Promise if this is the first task for this wallet/chain combination.

#### 3. **Result Promise Setup**

```typescript
let resolveResult: (v: T) => void
let rejectResult: (e: any) => void
const result = new Promise<T>((resolve, reject) => {
  resolveResult = resolve
  rejectResult = reject
})
```

Creates a separate Promise that will be returned to the caller. This decouples the caller's Promise from the internal queue chain, allowing proper error propagation while keeping the queue intact.

#### 4. **Task Execution Function**

```typescript
const run = async () => {
  const waitMs = Date.now() - startedAt
  try {
    this.logger.debug({ message: 'tx-gate: acquired', key, waitMs })
    const ret = await task()
    resolveResult(ret)
  } catch (error) {
    rejectResult(error)
  }
}
```

Wraps the actual task execution with:

- **Wait time tracking**: Measures how long the task waited in queue
- **Debug logging**: Logs when the "gate" is acquired
- **Result handling**: Forwards success/failure to the caller's Promise

#### 5. **Chain Continuation**

```typescript
const newTail = existingTail.then(run).catch((error) => {
  this.logger.debug({ message: 'tx-gate: failed to execute', key, error })
})
this.tails.set(key, newTail)
```

**Critical design decision**: The `.catch()` ensures the chain never breaks. If a task fails:

- The error is logged
- The chain continues for subsequent tasks
- The caller still gets the error through their separate Promise

#### 6. **Automatic Cleanup**

```typescript
newTail.finally(() => {
  if (this.tails.get(key) === newTail) {
    this.tails.delete(key)
  }
})
```

After a task completes, checks if it's still the latest tail. If so, removes the entry from the Map to prevent memory leaks. If new tasks were added, keeps the chain active.

### Execution Flow Example

Let's trace through a concrete example:

```typescript
// Time T0: Two transactions for same wallet/chain arrive simultaneously
queue.enqueue('0xABC', 1, async () => {
  // Transaction A: Takes 100ms
  await sendTransaction(...)
})

queue.enqueue('0xABC', 1, async () => {
  // Transaction B: Takes 50ms
  await sendTransaction(...)
})

// Time T0: Transaction A starts immediately
// Time T0: Transaction B is queued, waiting for A

// Time T0+100ms: Transaction A completes
// Time T0+100ms: Transaction B starts (waited 100ms)

// Time T0+150ms: Transaction B completes
// Time T0+150ms: Queue for '0xabc|1' is cleaned up
```

### Key Behavioral Characteristics

#### 1. **FIFO Ordering**

Tasks are strictly executed in the order they're enqueued for each key.

#### 2. **Error Isolation**

```typescript
// If Task 1 fails, Task 2 still executes
await queue.enqueue(wallet, chain, async () => throw Error('fail')) // Rejects
await queue.enqueue(wallet, chain, async () => 'success')          // Still runs!
```

#### 3. **Cross-Key Concurrency**

```typescript
// These run in parallel (different chains)
queue.enqueue('0xABC', 1, task1) // Chain 1
queue.enqueue('0xABC', 2, task2) // Chain 2 - runs immediately

// These also run in parallel (different wallets)
queue.enqueue('0xABC', 1, task3) // Wallet A
queue.enqueue('0xDEF', 1, task4) // Wallet B - runs immediately
```

#### 4. **Wait Time Visibility**

The service tracks and logs how long each task waited in the queue, providing insight into congestion:

```
tx-gate: acquired { key: '0xabc|1', waitMs: 0 }    // First task, no wait
tx-gate: acquired { key: '0xabc|1', waitMs: 105 }  // Second task waited
```

### Why This Design Works

1. **Minimal Lock Duration**: Only holds the "lock" during actual transaction signing/broadcasting, not during long operations like waiting for confirmations

2. **No Deadlocks**: The queue is append-only with automatic progression - there's no way to create circular dependencies

3. **Graceful Degradation**: Failures don't cascade - one failed transaction doesn't prevent others from executing

4. **Memory Efficient**: Automatic cleanup ensures the Map doesn't grow indefinitely

5. **Observable**: Built-in logging helps debug queue behavior and identify bottlenecks

### Limitations

- **Process-Local**: Only works within a single Node.js process
- **No Priority**: All tasks are FIFO - no way to expedite urgent transactions
- **No Cancellation**: Once enqueued, tasks can't be cancelled
- **No Max Queue Depth**: Could theoretically accept unlimited pending tasks

This solution provides robust transaction serialization with minimal overhead and maximum concurrency where safe, making it ideal for preventing nonce collisions in high-throughput environments.
