# Balance Manager

A comprehensive balance management system for tracking solver wallet balances across multiple chains with real-time updates and historical data storage.

## Architecture

The balance manager consists of 3 main components:

### 1. RPC Balance Service (`services/rpc-balance.service.ts`)
- Fetches balance data directly from blockchain RPC endpoints
- Supports both native tokens (ETH, MATIC, etc.) and ERC20 tokens
- Handles multiple chains in parallel
- Provides formatted balance data with token metadata

### 2. WebSocket Balance Service (`services/websocket-balance.service.ts`)
- Listens for real-time balance changes via WebSocket connections
- Monitors Transfer events for ERC20 tokens
- Monitors native token transfers in blocks
- Emits balance change events for the main service

### 3. Database Storage (`schemas/balance-record.schema.ts` & `repositories/balance-record.repository.ts`)
- Stores balance records with block-level precision
- Maintains historical balance data
- Provides efficient querying and statistics
- Prevents duplicate records with unique constraints

## Main Service (`services/balance-manager.service.ts`)

The `BalanceManagerService` orchestrates all components:
- Manages configuration and monitoring setup
- Handles WebSocket events and triggers RPC updates
- Provides high-level balance querying methods
- Runs periodic balance syncing
- Emits balance change events for other services

## Key Features

### Real-time Monitoring
- WebSocket connections for instant balance change detection
- Automatic RPC fetching when changes are detected
- Event-driven architecture for responsive updates

### Historical Tracking
- Block-level precision for balance records
- Efficient database indexing for fast queries
- Balance statistics and analytics

### Multi-chain Support
- Configurable RPC and WebSocket endpoints
- Parallel processing across chains
- Chain-specific native token handling

### Error Handling & Resilience
- Comprehensive error logging
- Retry mechanisms for failed requests
- Graceful degradation when services are unavailable

## Usage

### Basic Setup

```typescript
import { BalanceManagerService } from '@/balance-manager'

// Inject the service
constructor(private balanceManager: BalanceManagerService) {}

// Get current balance
const balance = await this.balanceManager.getCurrentBalance(
  BigInt(1), // Chain ID
  '0xA0b86a33E6441e6f9Bf0e74E8f48dc45D07d3e9b', // Token address
  '0x742d35Cc8Ebb5295b999C084b9dD5Bf7A93f6c4b'  // Solver address
)

// Get native balance
const nativeBalance = await this.balanceManager.getCurrentBalance(
  BigInt(1), // Chain ID
  'native',  // Native token
  '0x742d35Cc8Ebb5295b999C084b9dD5Bf7A93f6c4b'  // Solver address
)
```

### Adding Monitoring

```typescript
// Add a new solver to monitor
await this.balanceManager.addSolverToMonitor(
  '0x742d35Cc8Ebb5295b999C084b9dD5Bf7A93f6c4b'
)

// Add tokens to monitor for a chain
await this.balanceManager.addTokensToMonitor(
  BigInt(1), // Chain ID
  [
    '0xA0b86a33E6441e6f9Bf0e74E8f48dc45D07d3e9b', // USDC
    '0x6B175474E89094C44Da98b954EedeAC495271d0F'  // DAI
  ]
)
```

### Balance History & Statistics

```typescript
// Get balance history
const history = await this.balanceManager.getBalanceHistory(
  BigInt(1), // Chain ID
  '0xA0b86a33E6441e6f9Bf0e74E8f48dc45D07d3e9b', // Token
  '0x742d35Cc8Ebb5295b999C084b9dD5Bf7A93f6c4b', // Solver
  50 // Limit
)

// Get balance statistics
const stats = await this.balanceManager.getBalanceStats(
  BigInt(1), // Chain ID
  '0xA0b86a33E6441e6f9Bf0e74E8f48dc45D07d3e9b', // Token
  '0x742d35Cc8Ebb5295b999C084b9dD5Bf7A93f6c4b'  // Solver
)
```

### Event Handling

```typescript
import { OnEvent } from '@nestjs/event-emitter'
import { BalanceChangeEvent } from '@/balance-manager'

@OnEvent('balance.updated')
handleBalanceUpdate(event: BalanceChangeEvent) {
  console.log('Balance updated:', {
    chain: event.chainId,
    token: event.tokenAddress,
    solver: event.solverAddress,
    newBalance: event.newBalance,
    change: event.changeAmount
  })
}
```

## Configuration

The balance manager requires configuration for:

### RPC URLs
Set environment variables for chain RPC endpoints:
```bash
ETHEREUM_RPC_URL=https://eth.llamarpc.com
OPTIMISM_RPC_URL=https://mainnet.optimism.io
POLYGON_RPC_URL=https://polygon.llamarpc.com
BASE_RPC_URL=https://mainnet.base.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
```

### WebSocket URLs
Set environment variables for WebSocket endpoints:
```bash
ETHEREUM_WS_URL=wss://eth.llamarpc.com
OPTIMISM_WS_URL=wss://ws-mainnet.optimism.io
POLYGON_WS_URL=wss://polygon.llamarpc.com
BASE_WS_URL=wss://mainnet.base.org
ARBITRUM_WS_URL=wss://arb1.arbitrum.io/ws
```

## Database Schema

### BalanceRecord
```typescript
{
  chainId: string        // Chain identifier (stored as string for bigint)
  tokenAddress: string   // Token address or 'native'
  solverAddress: string  // Solver wallet address
  balance: string        // Balance amount (stored as string for bigint)
  blockNumber: string    // Block number (stored as string for bigint)
  blockHash: string      // Block hash
  timestamp: Date        // Timestamp of the balance record
  transactionHash?: string // Optional transaction hash
  decimals?: number      // Token decimals
  tokenSymbol?: string   // Token symbol
  tokenName?: string     // Token name
}
```

### Indexes
- Compound unique: `{chainId, tokenAddress, solverAddress, blockNumber}`
- Query optimization: `{chainId, tokenAddress, solverAddress}`
- Time-based: `{timestamp: -1}`
- Block-based: `{blockNumber: -1}`

## Monitoring & Observability

The balance manager provides comprehensive logging:
- RPC fetch operations and results
- WebSocket connection status and events
- Database operations and performance
- Error conditions and retry attempts
- Periodic sync operations

## Performance Considerations

### Batch Processing
- RPC requests are batched to avoid rate limiting
- Database upserts are used to prevent duplicates
- Parallel processing across chains

### Caching Strategy
- Latest balances are cached in the database
- WebSocket events trigger immediate updates
- Periodic sync ensures data consistency

### Resource Management
- WebSocket connections are managed with proper cleanup
- Database connections are pooled
- Memory usage is optimized with streaming queries

## Differences from Legacy Balance Module

This balance manager replaces the legacy balance module with:

1. **Unified Architecture**: Single service managing all balance operations
2. **Real-time Updates**: WebSocket-based monitoring vs polling
3. **Historical Data**: Full balance history vs in-memory caching
4. **Multi-chain Focus**: Built for multiple chains from the ground up
5. **Better Error Handling**: Comprehensive error recovery and logging
6. **Event-Driven**: Emits events for other services to consume
7. **Database Persistence**: All balances stored in MongoDB
8. **Block-level Precision**: Balances tied to specific blocks
9. **Statistics & Analytics**: Built-in balance statistics and trends
10. **Configuration Management**: Centralized configuration and monitoring setup