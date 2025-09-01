# Fulfillment Module

## Overview

The Fulfillment module is the core business logic engine that processes blockchain intents. It manages intent validation, strategy selection, and orchestrates the execution flow through a pluggable strategy pattern with immutable validation sets.

## Architecture

### Core Components

#### FulfillmentService
Central entry point for all intent submissions in the system.

**Responsibilities:**
- Accept intents from all blockchain listeners
- Persist intents to database
- Determine strategy based on configuration
- Queue intents for processing
- Handle deduplication

**Key Methods:**
- `submitIntent(intent: Intent)`: Process new intent from listeners
- `getStrategy(strategyName: string)`: Retrieve specific strategy
- `getDefaultStrategy()`: Get configured default strategy

#### FulfillmentProcessor
Queue processor that validates intents using strategy-specific validation sets.

**Responsibilities:**
- Process fulfillment queue jobs
- Load appropriate strategy
- Execute validation pipeline
- Queue valid intents for execution
- Update intent status

### Strategy System

The module implements multiple fulfillment strategies, each with its own validation rules and execution logic.

#### Base Strategy Abstract Class
```typescript
abstract class FulfillmentStrategy {
  protected readonly validations: ReadonlyArray<Validation>;
  
  abstract canHandle(intent: Intent): boolean;
  abstract execute(intent: Intent): Promise<void>;
  
  async validate(intent: Intent): Promise<ValidationResult>;
  async getQuote(intent: Intent): Promise<QuoteResult>;
}
```

### Available Strategies

#### StandardFulfillmentStrategy
Default strategy for standard intent fulfillment.

**Validations:**
- IntentFundedValidation
- RouteTokenValidation
- RouteCallsValidation
- RouteAmountLimitValidation
- ExpirationValidation
- ChainSupportValidation
- ProverSupportValidation
- ExecutorBalanceValidation
- StandardFeeValidation

**Use Cases:**
- Standard cross-chain transfers
- Smart contract interactions
- Token swaps

#### CrowdLiquidityFulfillmentStrategy
Uses crowd-sourced liquidity pools for fulfillment.

**Validations:**
- IntentFundedValidation
- RouteTokenValidation
- RouteCallsValidation
- ExpirationValidation
- ChainSupportValidation
- ProverSupportValidation
- CrowdLiquidityFeeValidation
- LiquidityPoolValidation

**Use Cases:**
- Large transfers requiring liquidity
- Community-funded operations
- Distributed liquidity provision

#### NativeIntentsFulfillmentStrategy
Handles native token transfers without smart contracts.

**Validations:**
- IntentFundedValidation
- RouteAmountLimitValidation
- ExpirationValidation
- ChainSupportValidation
- NativeFeeValidation
- ExecutorBalanceValidation

**Use Cases:**
- ETH/SOL/TRX transfers
- Gas fee operations
- Native token bridging

#### NegativeIntentsFulfillmentStrategy
Processes reverse or cancellation intents.

**Validations:**
- IntentFundedValidation
- ReverseRouteValidation
- ExpirationValidation
- ChainSupportValidation
- ProverSupportValidation
- NegativeFeeValidation

**Use Cases:**
- Intent cancellations
- Reverse operations
- Refund processing

#### RhinestoneFulfillmentStrategy
Smart account integration for advanced features.

**Validations:**
- IntentFundedValidation
- SmartAccountValidation
- RouteCallsValidation
- ChainSupportValidation
- ProverSupportValidation
- RhinestoneFeeValidation

**Use Cases:**
- Smart account operations
- Session key transactions
- Module-based execution

## Validation Framework

### Validation Interface
```typescript
interface Validation {
  validate(context: ValidationContext): Promise<ValidationResult>;
  getName(): string;
}

interface ValidationContext {
  intent: Intent;
  blockchainReader: BlockchainReaderService;
  proverService?: ProverService;
  logger: Logger;
}
```

### Core Validations

#### IntentFundedValidation
Verifies the intent is funded on the IntentSource contract.

**Checks:**
- On-chain funding status
- Contract state verification
- Funding amount validation

#### RouteTokenValidation
Validates token addresses in the route.

**Checks:**
- Token contract existence
- Token standard compliance
- Address format validation

#### RouteCallsValidation
Validates call targets and data.

**Checks:**
- Target contract existence
- Call data format
- Permission validation

#### RouteAmountLimitValidation
Enforces route-specific amount limits.

**Checks:**
- Maximum transfer amounts
- Per-chain limits
- Total value restrictions

#### ExpirationValidation
Ensures deadline hasn't passed.

**Checks:**
- Current timestamp vs deadline
- Grace period handling
- Time zone considerations

#### ChainSupportValidation
Verifies source and destination chains are supported.

**Checks:**
- Chain ID validation
- Network availability
- Configuration presence

#### ProverSupportValidation
Validates the route with configured provers.

**Checks:**
- Prover availability
- Route verification
- Cryptographic proofs

#### ExecutorBalanceValidation
Ensures executor has sufficient funds.

**Checks:**
- Native token balance
- Token balances
- Gas requirements

### Fee Validations

#### StandardFeeValidation
Standard fee calculation and validation.

**Parameters:**
- Base fee amount
- Percentage fee (basis points)
- Minimum fee threshold

#### CrowdLiquidityFeeValidation
Crowd liquidity specific fees.

**Parameters:**
- Liquidity provider fee
- Pool management fee
- Slippage tolerance

#### NativeFeeValidation
Native token transfer fees.

**Parameters:**
- Network fee estimation
- Priority fee calculation
- Dynamic fee adjustment

## Configuration

### Strategy Configuration
```typescript
interface FulfillmentConfig {
  defaultStrategy: string;
  strategies: {
    standard: { enabled: boolean };
    crowdLiquidity: { enabled: boolean };
    nativeIntents: { enabled: boolean };
    negativeIntents: { enabled: boolean };
    rhinestone: { enabled: boolean };
  };
  validations: {
    routeLimits: {
      default: bigint;
      routes: Array<{
        chainId: bigint;
        limit: bigint;
      }>;
    };
    fees: {
      standard: {
        baseFee: bigint;
        percentageFee: number;
      };
      crowdLiquidity: {
        baseFee: bigint;
        percentageFee: number;
      };
      native: {
        baseFee: bigint;
        percentageFee: number;
      };
    };
  };
}
```

## Usage Flow

### 1. Intent Submission
```typescript
// Called by blockchain listeners
await fulfillmentService.submitIntent(intent);
```

### 2. Strategy Selection
```typescript
// Automatic based on configuration
const strategy = fulfillmentService.getDefaultStrategy();
// Or specific strategy
const strategy = fulfillmentService.getStrategy('crowdLiquidity');
```

### 3. Validation Execution
```typescript
// Performed by FulfillmentProcessor
const validationResult = await strategy.validate(intent);
if (validationResult.valid) {
  await strategy.execute(intent);
}
```

### 4. Quote Generation
```typescript
// Used by API for external systems
const quote = await strategy.getQuote(intent);
// Returns fees and validation results
```

## Adding New Strategies

### Step 1: Create Strategy Class
```typescript
@Injectable()
export class MyCustomStrategy extends FulfillmentStrategy {
  constructor(
    // Inject required validations
    private readonly fundedValidation: IntentFundedValidation,
    private readonly customValidation: MyCustomValidation,
    // ... other dependencies
  ) {
    super();
    // Define immutable validation set
    this.validations = Object.freeze([
      this.fundedValidation,
      this.customValidation,
    ]);
  }

  canHandle(intent: Intent): boolean {
    // Define strategy selection logic
    return intent.metadata?.type === 'custom';
  }

  async execute(intent: Intent): Promise<void> {
    // Implementation logic
    await this.queueService.addIntentToExecutionQueue(
      intent,
      'myCustom'
    );
  }
}
```

### Step 2: Register in Module
```typescript
@Module({
  providers: [
    MyCustomStrategy,
    MyCustomValidation,
    // ... other providers
  ],
})
export class FulfillmentModule {}
```

### Step 3: Add to FulfillmentService
```typescript
// Update strategy map in FulfillmentService
this.strategies.set('myCustom', myCustomStrategy);
```

### Step 4: Configure
Add configuration for the new strategy in environment variables.

## Adding New Validations

### Step 1: Create Validation Class
```typescript
@Injectable()
export class MyCustomValidation implements Validation {
  constructor(
    private readonly configService: FulfillmentConfigService,
    private readonly otelService: OpenTelemetryService,
  ) {}

  getName(): string {
    return 'MyCustomValidation';
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const span = this.otelService.startSpan('validation.custom');
    
    try {
      // Validation logic
      const isValid = await this.checkCustomCondition(context.intent);
      
      if (!isValid) {
        return {
          valid: false,
          reason: 'Custom condition not met',
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
}
```

### Step 2: Add to Strategy
Include the validation in the strategy's immutable validation set.

## Best Practices

### Validation Design
- Keep validations focused and single-purpose
- Make validations reusable across strategies
- Use configuration for thresholds and limits
- Implement proper error messages

### Strategy Implementation
- Define clear strategy selection criteria
- Keep execution logic separate from validation
- Use immutable validation sets
- Implement comprehensive logging

### Error Handling
- Provide detailed validation failure reasons
- Log validation context for debugging
- Handle edge cases gracefully
- Implement proper cleanup on failure

### Performance
- Cache validation results when possible
- Parallelize independent validations
- Minimize blockchain calls
- Use efficient data structures

## OpenTelemetry Tracing

All strategies and validations implement distributed tracing:

### Strategy Tracing
- Automatic spans for `validate()` and `getQuote()`
- Custom spans in `execute()` implementation
- Context propagation through validation chain

### Validation Tracing
- Check for active parent span
- Create child spans for validation logic
- Record validation results as attributes
- Proper error recording

## Troubleshooting

### Common Issues

1. **Validation Failures**
   - Check validation configuration
   - Verify blockchain state
   - Review validation order
   - Check error messages

2. **Strategy Not Found**
   - Verify strategy registration
   - Check configuration
   - Ensure module imports
   - Review strategy map

3. **Queue Processing Issues**
   - Check Redis connection
   - Verify queue names
   - Review job structure
   - Monitor queue depth

4. **Performance Problems**
   - Profile validation execution
   - Check blockchain RPC latency
   - Review caching strategy
   - Optimize validation order