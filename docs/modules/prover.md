# Prover Module

## Overview

The Prover module validates intent routes between blockchain networks using cryptographic proofs. It supports multiple prover implementations (HyperProver, MetalayerProver) with chain-specific contract configurations, ensuring that cross-chain intents follow valid and secure routes.

## Architecture

### Core Components

#### ProverService
Main service that manages and delegates to specific prover implementations.

**Responsibilities:**
- Initialize and manage prover instances
- Route validation requests to appropriate provers
- Handle prover selection based on chain and contract
- Cache prover instances for performance

**Key Methods:**
- `validateRoute(intent: Intent)`: Validate intent route
- `getProverForRoute(source: bigint, destination: bigint)`: Get compatible prover
- `isRouteSupported(source: bigint, destination: bigint)`: Check route support

#### BaseProver Abstract Class
Abstract base class that all provers must extend.

```typescript
abstract class BaseProver {
  protected readonly type: ProverType;
  protected readonly chainConfigs: Map<bigint, ProverChainConfig>;
  
  abstract validateRoute(intent: Intent): Promise<ValidationResult>;
  
  hasChainSupport(chainId: bigint): boolean;
  getContractAddress(chainId: bigint): string | undefined;
}
```

### Prover Implementations

#### HyperProver
Validates routes using HyperLane protocol.

**Features:**
- Cross-chain message verification
- Merkle proof validation
- Optimistic fraud proofs
- Multi-chain support

**Configuration:**
```typescript
interface HyperProverConfig {
  type: 'hyper';
  chainConfigs: Array<{
    chainId: bigint;
    contractAddress: string;
    confirmations?: number;
  }>;
}
```

**Validation Process:**
1. Verify source chain contract
2. Check destination chain support
3. Validate merkle proofs
4. Confirm message format
5. Verify signatures

#### MetalayerProver
Validates routes using Metalayer protocol.

**Features:**
- State proof verification
- Cross-chain state sync
- Atomic swap validation
- Bridge security checks

**Configuration:**
```typescript
interface MetalayerProverConfig {
  type: 'metalayer';
  chainConfigs: Array<{
    chainId: bigint;
    contractAddress: string;
    validatorSet?: string[];
  }>;
}
```

**Validation Process:**
1. Verify validator signatures
2. Check state transitions
3. Validate proof data
4. Confirm bridge contracts
5. Verify execution params

## Configuration

### Environment Variables
```bash
# HyperProver Configuration
PROVERS_0_TYPE=hyper
PROVERS_0_CHAIN_CONFIGS_0_CHAIN_ID=1
PROVERS_0_CHAIN_CONFIGS_0_CONTRACT_ADDRESS=0x1234...
PROVERS_0_CHAIN_CONFIGS_1_CHAIN_ID=10
PROVERS_0_CHAIN_CONFIGS_1_CONTRACT_ADDRESS=0x5678...

# MetalayerProver Configuration
PROVERS_1_TYPE=metalayer
PROVERS_1_CHAIN_CONFIGS_0_CHAIN_ID=1
PROVERS_1_CHAIN_CONFIGS_0_CONTRACT_ADDRESS=0xabcd...
PROVERS_1_CHAIN_CONFIGS_1_CHAIN_ID=137
PROVERS_1_CHAIN_CONFIGS_1_CONTRACT_ADDRESS=0xef01...
```

### Configuration Schema
```typescript
interface ProverConfig {
  provers: Array<{
    type: 'hyper' | 'metalayer';
    chainConfigs: Array<{
      chainId: bigint;
      contractAddress: string;
      // Type-specific additional config
      [key: string]: any;
    }>;
  }>;
}
```

## Usage

### Validating Routes
```typescript
@Injectable()
export class ProverSupportValidation implements Validation {
  constructor(
    private readonly proverService: ProverService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const { intent } = context;
    
    // Check if route is supported
    if (!this.proverService.isRouteSupported(
      intent.route.source,
      intent.route.destination
    )) {
      return {
        valid: false,
        reason: 'No prover available for this route',
      };
    }
    
    // Validate the route
    const result = await this.proverService.validateRoute(intent);
    
    return result;
  }
}
```

### Getting Prover Information
```typescript
// Check route support
const isSupported = proverService.isRouteSupported(
  1n, // Ethereum
  10n // Optimism
);

// Get specific prover
const prover = proverService.getProverForRoute(1n, 10n);
if (prover) {
  console.log(`Using ${prover.type} prover`);
}

// Get contract address
const contractAddress = prover.getContractAddress(1n);
```

## Adding New Provers

### Step 1: Create Prover Class
```typescript
// src/modules/prover/provers/my-prover.ts
import { Injectable } from '@nestjs/common';
import { BaseProver } from '@/common/abstractions/base-prover.abstract';

@Injectable()
export class MyProver extends BaseProver {
  constructor(
    private readonly blockchainReader: BlockchainReaderService,
    private readonly otelService: OpenTelemetryService,
  ) {
    super();
    this.type = ProverType.MY_PROVER;
  }

  async validateRoute(intent: Intent): Promise<ValidationResult> {
    const span = this.otelService.startSpan('prover.my-prover.validate');
    
    try {
      // Check chain support
      if (!this.hasChainSupport(intent.route.source) ||
          !this.hasChainSupport(intent.route.destination)) {
        return {
          valid: false,
          reason: 'Chain not supported by prover',
        };
      }
      
      // Custom validation logic
      const isValid = await this.performCustomValidation(intent);
      
      if (!isValid) {
        return {
          valid: false,
          reason: 'Custom validation failed',
        };
      }
      
      span.setStatus({ code: SpanStatusCode.OK });
      return { valid: true };
      
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }
  
  private async performCustomValidation(
    intent: Intent
  ): Promise<boolean> {
    // Implementation specific validation
    return true;
  }
}
```

### Step 2: Add ProverType Enum
```typescript
// src/modules/prover/types/prover.types.ts
export enum ProverType {
  HYPER = 'hyper',
  METALAYER = 'metalayer',
  MY_PROVER = 'my_prover', // Add new type
}
```

### Step 3: Register in ProverService
```typescript
// src/modules/prover/prover.service.ts
private initializeProvers(): void {
  for (const config of this.configService.provers) {
    let prover: BaseProver;
    
    switch (config.type) {
      case ProverType.HYPER:
        prover = new HyperProver(/* dependencies */);
        break;
      case ProverType.METALAYER:
        prover = new MetalayerProver(/* dependencies */);
        break;
      case ProverType.MY_PROVER: // Add new case
        prover = new MyProver(/* dependencies */);
        break;
      default:
        throw new Error(`Unknown prover type: ${config.type}`);
    }
    
    // Initialize with config
    prover.initialize(config.chainConfigs);
    this.provers.push(prover);
  }
}
```

### Step 4: Update Module
```typescript
// src/modules/prover/prover.module.ts
@Module({
  providers: [
    ProverService,
    ProverConfigService,
    HyperProver,
    MetalayerProver,
    MyProver, // Add new prover
  ],
  exports: [ProverService],
})
export class ProverModule {}
```

## Validation Logic

### Common Validation Steps

1. **Chain Support Verification**
   - Check source chain configuration
   - Check destination chain configuration
   - Verify contract deployment

2. **Route Validation**
   - Validate route parameters
   - Check route permissions
   - Verify route state

3. **Proof Verification**
   - Validate cryptographic proofs
   - Check signatures
   - Verify merkle proofs

4. **State Validation**
   - Confirm on-chain state
   - Validate state transitions
   - Check finality

### Validation Result Structure
```typescript
interface ValidationResult {
  valid: boolean;
  reason?: string;
  metadata?: {
    proverType: string;
    sourceContract: string;
    destinationContract: string;
    proofData?: any;
  };
}
```

## Integration with Fulfillment

### ProverSupportValidation
All strategies that require route validation include ProverSupportValidation:

```typescript
export class StandardFulfillmentStrategy extends FulfillmentStrategy {
  constructor(
    // ... other validations
    private readonly proverValidation: ProverSupportValidation,
  ) {
    super();
    this.validations = Object.freeze([
      // ... other validations
      this.proverValidation,
    ]);
  }
}
```

### Validation Flow
1. Strategy runs validation pipeline
2. ProverSupportValidation invoked
3. ProverService selects appropriate prover
4. Prover validates the route
5. Result returned to strategy

## Performance Optimization

### Caching
- Prover instances cached after initialization
- Contract addresses cached in memory
- Validation results can be cached (TTL-based)

### Parallel Validation
When multiple provers support a route:
```typescript
const results = await Promise.all(
  compatibleProvers.map(prover => prover.validateRoute(intent))
);
// Require all provers to pass
return results.every(r => r.valid);
```

### Connection Pooling
- Reuse blockchain connections
- Maintain persistent RPC connections
- Implement connection retry logic

## Monitoring and Observability

### OpenTelemetry Tracing
All provers implement distributed tracing:

```typescript
// Automatic span creation
const span = this.otelService.startSpan('prover.validate', {
  attributes: {
    'prover.type': this.type,
    'route.source': intent.route.source.toString(),
    'route.destination': intent.route.destination.toString(),
  },
});
```

### Metrics
- Validation success rate
- Validation duration
- Prover availability
- Route support coverage

### Logging
```typescript
this.logger.debug('Validating route', {
  prover: this.type,
  source: intent.route.source,
  destination: intent.route.destination,
  intentHash: intent.intentHash,
});
```

## Security Considerations

### Contract Verification
- Verify contract addresses on-chain
- Check contract ownership
- Validate contract code
- Monitor contract upgrades

### Proof Security
- Validate proof integrity
- Check signature validity
- Verify proof freshness
- Prevent replay attacks

### Configuration Security
- Validate contract addresses format
- Secure storage of addresses
- Regular security audits
- Monitor for suspicious activity

## Troubleshooting

### Common Issues

1. **No Prover Available**
   - Check prover configuration
   - Verify chain IDs
   - Ensure contracts deployed
   - Review prover initialization

2. **Validation Failures**
   - Check contract state
   - Verify proof data
   - Review chain connectivity
   - Inspect validation logs

3. **Performance Issues**
   - Monitor RPC latency
   - Check caching effectiveness
   - Review parallel processing
   - Optimize proof verification

4. **Configuration Problems**
   - Validate environment variables
   - Check contract addresses
   - Verify chain configurations
   - Review type mappings

### Debug Mode
Enable detailed logging:
```typescript
// Set log level
process.env.LOG_LEVEL = 'debug';

// Log prover details
this.logger.debug('Prover configuration', {
  type: this.type,
  chains: Array.from(this.chainConfigs.keys()),
});
```