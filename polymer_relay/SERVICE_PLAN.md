# Polymer Relay Service Plan

## Overview
Service to relay IntentFulfilled events back to the PolymerProver contract on the origin chain when the eco-solver successfully solves an intent using the polymer prover. This service handles the proof generation and validation process for both EVM and TRON chains.

## Core Components

### 1. PolymerRelayService (main service class)
**Location:** `src/PolymerRelayService.ts`

**Responsibilities:**
- Main entry point for relaying intent fulfillment proofs
- Orchestrates the proof generation and relay process
- Handles chain-specific routing (EVM vs TRON)

**Key Methods:**
- `relayIntentFulfillment(relayInput: RelayInput): Promise<RelayResult>`
- `validateEnvironment(): void`
- `loadContractABIs(): ContractABIs`

### 2. ChainHandler (abstract base + implementations)
**Location:** `src/handlers/`

**Files:**
- `ChainHandler.ts` - Abstract base class
- `EVMChainHandler.ts` - EVM-specific implementation
- `TronChainHandler.ts` - TRON-specific implementation

**Responsibilities:**
- Chain-specific transaction handling
- Event fetching and parsing
- Contract interaction logic

**Key Methods:**
- `fetchIntentProvenEvent(txHash: string, blockNumber: number): Promise<IntentProvenEvent>`
- `relayProof(proof: string, proverAddress: string): Promise<TransactionResult>`
- `getGlobalLogIndex(txHash: string, eventSignature: string): Promise<number>`

### 3. PolymerProofClient
**Location:** `src/clients/PolymerProofClient.ts`

**Responsibilities:**
- Interface with Polymer API for proof generation
- Handle proof job creation and polling
- Retry logic and error handling

**Key Methods:**
- `requestProof(params: ProofRequestParams): Promise<string>`
- `requestProofJob(params: ProofRequestParams): Promise<number>`
- `pollForProof(jobId: number): Promise<string>`

### 4. ChainConfig
**Location:** `src/config/ChainConfig.ts`

**Responsibilities:**
- Manage chain configurations
- RPC URL resolution from chain IDs
- Contract addresses and chain metadata

**Structure:**
```typescript
interface ChainConfig {
  chainId: number;
  name: string;
  type: 'evm' | 'tron';
  proverAddress: string;
  nativeCurrency: string;
  getRpcUrl(chainId: number): Promise<string>; // Uses existing black box service
}
```

### 5. Types and Interfaces
**Location:** `src/types/`

**Files:**
- `RelayTypes.ts` - Core relay data structures
- `ChainTypes.ts` - Chain-specific types
- `ProofTypes.ts` - Proof-related types

**Key Types:**
```typescript
interface RelayInput {
  txHash: string;
  sourceChainId: number;
  blockNumber: number;
  eventName: string;
  intentHash: string;
  globalLogIndex?: number;
  originalIntent: {
    sourceChainId: number;
    destChainId: number;
    creator: string;
    intentHash: string;
  };
}

interface RelayResult {
  success: boolean;
  relayTxHash?: string;
  relayBlockNumber?: number;
  gasUsed?: string;
  error?: string;
  timestamp: string;
}
```

## Implementation Steps

### Phase 1: Core Infrastructure
1. Set up TypeScript project structure with proper configuration
2. Implement type definitions and interfaces
3. Create ChainConfig with RPC URL service integration
4. Set up environment variable validation and loading

### Phase 2: Polymer API Integration
1. Implement PolymerProofClient with retry logic
2. Add proof job creation and polling mechanisms
3. Handle base64 to hex conversion for proofs
4. Implement error handling and timeout management

### Phase 3: Chain Handlers
1. Create abstract ChainHandler base class
2. Implement EVMChainHandler:
   - Event fetching via ethers.js
   - Global log index detection
   - Contract interaction for validation
3. Implement TronChainHandler:
   - TronWeb integration
   - TRON-specific event parsing
   - Energy/fee limit management

### Phase 4: Main Service Integration
1. Implement PolymerRelayService orchestration logic
2. Add chain detection and routing
3. Integrate with eco-solver's existing services
4. Add comprehensive logging and monitoring

### Phase 5: Testing & Deployment
1. Unit tests for each component
2. Integration tests with mock Polymer API
3. End-to-end testing on testnets
4. Production deployment configuration

## Key Differences from Original Script

### Improvements:
1. **Modular Architecture:** Separated concerns into distinct services
2. **Chain Abstraction:** Cleaner separation between EVM and TRON logic
3. **Dynamic Chain Support:** Uses chainId parameter with RPC URL service
4. **Better Error Handling:** Structured error types and recovery strategies
5. **Production Ready:** Proper logging, monitoring, and configuration management

### Maintained Features:
1. Full Polymer API integration with proof generation
2. Support for both EVM and TRON chains
3. Event detection and parsing logic
4. Contract validation calls
5. Comprehensive result tracking

## Environment Requirements

```env
PRIVATE_KEY=<relayer_private_key>
POLYMER_API_KEY=<polymer_api_key>
POLYMER_API_BASE_URL=https://proof.polymer.zone
```

## Dependencies

```json
{
  "dependencies": {
    "ethers": "^6.x",
    "tronweb": "^5.x",
    "axios": "^1.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "@types/node": "^20.x",
    "typescript": "^5.x",
    "jest": "^29.x",
    "@types/jest": "^29.x"
  }
}
```

## API Usage Example

```typescript
import { PolymerRelayService } from './polymer_relay';

const service = new PolymerRelayService();

const relayInput = {
  txHash: '0x...',
  sourceChainId: 10, // Optimism
  blockNumber: 12345678,
  eventName: 'IntentFulfilledFromSource',
  intentHash: '0x...',
  originalIntent: {
    sourceChainId: 728126428, // Tron
    destChainId: 10,
    creator: '0x...',
    intentHash: '0x...'
  }
};

const result = await service.relayIntentFulfillment(relayInput);
console.log('Relay result:', result);
```

## Next Steps

1. Review and approve this plan
2. Begin implementation starting with Phase 1
3. Set up development environment and testing framework
4. Integrate with eco-solver's existing infrastructure
5. Deploy to staging for testing