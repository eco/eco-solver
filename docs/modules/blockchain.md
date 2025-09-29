# Blockchain Module

## Overview

The Blockchain module provides a unified abstraction layer for interacting with multiple blockchain networks. It supports EVM-compatible chains, Solana (SVM), and Tron (TVM) through a consistent interface while maintaining chain-specific optimizations.

## Architecture

### Core Services

#### BlockchainExecutorService
Central service that delegates execution to chain-specific executors based on chain ID.

**Responsibilities:**
- Route execution requests to appropriate chain executor
- Manage executor lifecycle
- Handle cross-chain execution coordination

**Key Methods:**
- `executeIntent(intent: Intent, walletId?: string)`: Execute an intent on the target chain
- `getExecutor(chainId: bigint)`: Get chain-specific executor

#### BlockchainReaderService
Unified interface for reading blockchain state across different chains.

**Responsibilities:**
- Abstract chain-specific data reading
- Cache frequently accessed data
- Provide consistent data format

**Key Methods:**
- `getBalance(address: UniversalAddress, chainId: bigint)`: Get native token balance
- `getTokenBalance(token: UniversalAddress, wallet: UniversalAddress, chainId: bigint)`: Get token balance
- `isIntentFunded(intent: Intent)`: Check if intent is funded on-chain
- `isAddressValid(address: string, chainId: bigint)`: Validate address format

#### BlockchainProcessor
Queue processor that handles blockchain execution jobs from the execution queue.

**Responsibilities:**
- Process execution queue jobs
- Handle retry logic
- Update intent status
- Emit execution events

### Chain-Specific Modules

## EVM Module

### Services

#### EvmListener
Self-initializing listener that monitors EVM chains for IntentCreated events.

**Features:**
- Multiple network support
- Event filtering and parsing
- Automatic reconnection
- Block confirmation handling

#### EvmExecutor
Handles transaction execution on EVM chains.

**Features:**
- Gas estimation and optimization
- Transaction batching via multicall3
- Nonce management
- Error recovery

#### EvmReader
Reads state from EVM chains.

**Features:**
- Contract state reading
- Balance queries
- Token information
- Intent funding verification

### Wallet System

#### Wallet Types

1. **BasicWallet**
   - Standard EOA (Externally Owned Account)
   - Private key-based signing
   - Multicall3 support for batching

2. **KernelWallet**
   - Smart account implementation
   - Multiple signer support (EOA, KMS)
   - Advanced features (session keys, modules)

#### Wallet Manager
- Manages multiple wallet instances
- Handles wallet selection by ID
- Provides wallet factory pattern

## SVM Module (Solana)

### Services

#### SvmListener
Monitors Solana blockchain for intent events.

**Features:**
- Program event monitoring
- Transaction confirmation tracking
- Slot-based event ordering

#### SvmExecutor
Executes transactions on Solana.

**Features:**
- Transaction building and signing
- Program instruction creation
- Priority fee handling
- Transaction confirmation

#### SvmReader
Reads state from Solana blockchain.

**Features:**
- Account data reading
- SPL token balance queries
- Program state inspection

## TVM Module (Tron)

### Services

#### TvmListener
Monitors Tron blockchain for intent events.

**Features:**
- Event log monitoring
- Block confirmation
- Energy/bandwidth management

#### TvmExecutor
Executes transactions on Tron.

**Features:**
- Smart contract interaction
- TRC20 token transfers
- Energy estimation
- Transaction broadcasting

#### TvmReader
Reads state from Tron blockchain.

**Features:**
- Account information
- TRC20 token balances
- Contract state reading

## Base Abstractions

### BaseChainListener
Abstract class that all chain listeners extend.

**Required Implementations:**
- `startListening()`: Begin monitoring chain events
- `stopListening()`: Clean shutdown
- `parseIntentFromEvent(event)`: Convert chain event to Intent

**Provided Methods:**
- `onModuleInit()`: NestJS lifecycle hook
- `onModuleDestroy()`: Cleanup on shutdown
- `submitIntent(intent)`: Send to fulfillment service

### BaseChainExecutor
Abstract class for chain-specific executors.

**Required Implementations:**
- `executeIntent(intent, options)`: Execute intent on chain
- `estimateGas(intent)`: Calculate gas requirements
- `validateExecution(intent)`: Pre-execution validation

### BaseChainReader
Abstract class for reading blockchain state.

**Required Implementations:**
- `getBalance(address)`: Native token balance
- `getTokenBalance(token, wallet)`: Token balance
- `isIntentFunded(intent)`: Funding verification
- `isAddressValid(address)`: Address validation

## Configuration

### EVM Configuration
```typescript
interface EvmConfig {
  networks: Array<{
    chainId: bigint;
    rpcUrls: string[];
    intentSourceAddress: string;
    portalAddress: string;
    confirmations: number;
    gasSettings: {
      maxFeePerGas?: bigint;
      maxPriorityFeePerGas?: bigint;
      gasLimit?: bigint;
    };
  }>;
  wallets: {
    basic?: { privateKey: string };
    kernel?: {
      signerType: 'eoa' | 'kms';
      signerConfig: Record<string, any>;
    };
  };
}
```

### Solana Configuration
```typescript
interface SolanaConfig {
  rpcUrl: string;
  commitment: 'processed' | 'confirmed' | 'finalized';
  programId: string;
  secretKey: number[];
}
```

### Tron Configuration
```typescript
interface TronConfig {
  network: string;
  rpcUrl: string;
  privateKey: string;
  contractAddress: string;
  energyLimit: number;
}
```

## Usage Examples

### Executing an Intent
```typescript
// The blockchain processor automatically handles this
await blockchainExecutorService.executeIntent(intent, 'basic');
```

### Reading Blockchain State
```typescript
// Get native balance
const balance = await blockchainReaderService.getBalance(
  universalAddress,
  chainId
);

// Check token balance
const tokenBalance = await blockchainReaderService.getTokenBalance(
  tokenAddress,
  walletAddress,
  chainId
);

// Verify intent funding
const isFunded = await blockchainReaderService.isIntentFunded(intent);
```

### Listening for Events
Listeners automatically start when the module initializes:
```typescript
// No manual initialization needed - listeners self-start
// Events flow through: Listener -> FulfillmentService -> Queue
```

## Adding New Blockchains

### Step 1: Create Module Structure
```
src/modules/blockchain/[chain]/
├── [chain].module.ts
├── listeners/
│   └── [chain].listener.ts
├── services/
│   ├── [chain].executor.service.ts
│   └── [chain].reader.service.ts
└── types/
    └── index.ts
```

### Step 2: Extend Base Classes
```typescript
export class MyChainListener extends BaseChainListener {
  // Implement required methods
}

export class MyChainExecutor extends BaseChainExecutor {
  // Implement required methods
}

export class MyChainReader extends BaseChainReader {
  // Implement required methods
}
```

### Step 3: Register in BlockchainModule
```typescript
@Module({
  imports: [
    MyChainModule,
    // ... other chain modules
  ],
})
export class BlockchainModule {}
```

### Step 4: Add Configuration
Update configuration schema and add chain detection logic.

## Best Practices

### Error Handling
- Always wrap blockchain calls in try-catch
- Implement retry logic for transient failures
- Log errors with context for debugging
- Handle chain-specific error codes

### Performance
- Use connection pooling for RPC clients
- Batch read operations when possible
- Cache frequently accessed data
- Implement circuit breakers for failing endpoints

### Security
- Never log private keys or sensitive data
- Validate all addresses before operations
- Use secure key management (KMS when possible)
- Implement transaction simulation before execution

### Monitoring
- Track RPC call latency
- Monitor gas usage and costs
- Alert on failed transactions
- Log important events with correlation IDs

## Troubleshooting

### Common Issues

1. **RPC Connection Failures**
   - Check RPC URL configuration
   - Verify network connectivity
   - Ensure rate limits not exceeded
   - Try alternative RPC endpoints

2. **Transaction Failures**
   - Check wallet balance
   - Verify gas settings
   - Ensure correct network
   - Check contract addresses

3. **Event Listening Issues**
   - Verify contract addresses
   - Check event signatures
   - Ensure proper confirmations
   - Monitor websocket connections

4. **Address Format Errors**
   - Use UniversalAddress for cross-chain
   - Validate addresses before use
   - Handle chain-specific formats
   - Check address normalization