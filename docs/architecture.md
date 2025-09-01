# System Architecture

## Overview

The Blockchain Intent Solver is a high-performance, multi-chain intent processing system built with NestJS. It follows a modular, event-driven architecture designed for scalability, maintainability, and extensibility across multiple blockchain networks.

## Core Architecture Principles

### 1. Modular Design
- **Module Isolation**: Each functional domain is encapsulated in its own NestJS module
- **Dependency Injection**: Services are injected using NestJS's DI container
- **Clear Boundaries**: Modules communicate through well-defined interfaces

### 2. Event-Driven Processing
- **Blockchain Listeners**: Self-initializing listeners monitor on-chain events
- **Queue-Based Architecture**: Asynchronous processing using BullMQ and Redis
- **Decoupled Components**: Producers and consumers operate independently

### 3. Chain Abstraction
- **Base Classes**: Abstract classes define common interfaces for all chains
- **Universal Addresses**: Chain-agnostic address representation using normalized bytes32
- **Reader/Executor Pattern**: Separate services for reading and writing blockchain state

### 4. Type Safety
- **Zod Schemas**: Runtime validation and type inference for configuration
- **TypeScript Strict Mode**: Full type safety across the codebase
- **Branded Types**: UniversalAddress and chain-specific address types

## System Components

### Entry Points

1. **Blockchain Listeners** (Push)
   - Monitor blockchain events for new intents
   - Self-initialize on module startup
   - Submit intents to FulfillmentService

2. **REST API** (Pull)
   - External systems can query and submit intents
   - Quote endpoint for validation and fee calculation
   - Swagger documentation for API exploration

### Core Processing Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Blockchain   │────>│  Fulfillment     │────>│      Queue      │
│    Listeners    │     │    Service       │     │    Service      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                         │
                               ▼                         ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │     Intents      │     │   Fulfillment   │
                        │     Service      │     │     Queue       │
                        └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │   Fulfillment   │
                                                  │   Processor     │
                                                  └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │    Strategy     │
                                                  │   Validation    │
                                                  └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │   Execution     │
                                                  │     Queue       │
                                                  └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │   Blockchain   │
                                                  │   Processor    │
                                                  └─────────────────┘
                                                         │
                                                         ▼
                                                  ┌─────────────────┐
                                                  │   Blockchain   │
                                                  │    Executor    │
                                                  └─────────────────┘
```

### Module Hierarchy

```
App Module
├── Config Module (Global)
│   ├── AppConfigService
│   ├── DatabaseConfigService
│   ├── RedisConfigService
│   ├── EvmConfigService
│   ├── SolanaConfigService
│   ├── TvmConfigService
│   ├── FulfillmentConfigService
│   ├── ProverConfigService
│   ├── QueueConfigService
│   └── TokenConfigService
├── Logging Module (Global)
│   ├── LoggerService (Request-scoped)
│   └── SystemLoggerService (System-level)
├── OpenTelemetry Module (Global)
│   ├── OpenTelemetryService
│   └── QueueTracingService
├── Health Module
│   ├── Liveness Check
│   └── Readiness Check
├── API Module
│   └── Quotes Module
├── Intents Module
│   └── IntentsService
├── Queue Module
│   ├── QueueService
│   └── Queue Management
├── Blockchain Module
│   ├── BlockchainExecutorService
│   ├── BlockchainReaderService
│   ├── BlockchainProcessor
│   ├── EVM Module
│   │   ├── EvmListener
│   │   ├── EvmExecutor
│   │   ├── EvmReader
│   │   └── Wallet System
│   ├── SVM Module
│   │   ├── SvmListener
│   │   ├── SvmExecutor
│   │   └── SvmReader
│   └── TVM Module
│       ├── TvmListener
│       ├── TvmExecutor
│       └── TvmReader
├── Fulfillment Module
│   ├── FulfillmentService
│   ├── FulfillmentProcessor
│   ├── Strategies
│   │   ├── StandardFulfillmentStrategy
│   │   ├── CrowdLiquidityStrategy
│   │   ├── NativeIntentsStrategy
│   │   ├── NegativeIntentsStrategy
│   │   └── RhinestoneStrategy
│   └── Validations
│       ├── IntentFundedValidation
│       ├── RouteValidations
│       ├── FeeValidations
│       └── BalanceValidations
├── Prover Module
│   ├── ProverService
│   ├── HyperProver
│   └── MetalayerProver
└── Token Module
    └── TokenService
```

## Data Flow Patterns

### 1. Intent Submission Flow
1. Blockchain events detected by listeners
2. Listeners call `FulfillmentService.submitIntent()`
3. FulfillmentService persists intent to MongoDB
4. FulfillmentService determines strategy from configuration
5. Intent queued to fulfillment queue with strategy name

### 2. Validation Flow
1. FulfillmentProcessor retrieves intent from queue
2. Loads strategy based on job data
3. Strategy runs immutable validation set
4. Each validation can access BlockchainReaderService and ProverService
5. Validation results determine next step

### 3. Execution Flow
1. Valid intents queued to execution queue
2. BlockchainProcessor retrieves job
3. Delegates to BlockchainExecutorService
4. Executor selects chain-specific implementation
5. Transaction executed on target blockchain
6. Status updated in database

## Key Design Patterns

### 1. Abstract Factory Pattern
- Base abstract classes for chain-specific implementations
- Factories create instances based on chain type
- Examples: BaseChainListener, BaseChainExecutor, BaseChainReader

### 2. Strategy Pattern
- Multiple fulfillment strategies with common interface
- Runtime strategy selection based on configuration
- Each strategy defines its own validation set

### 3. Chain of Responsibility
- Validation pipeline with sequential checks
- Each validation can pass or fail
- Failed validation stops the chain

### 4. Repository Pattern
- IntentsService abstracts database operations
- Mongoose schemas handle data persistence
- Conversion utilities for data transformation

### 5. Observer Pattern
- Blockchain listeners observe chain events
- Event-driven architecture with queue notifications
- Decoupled components through event emission

## Configuration Architecture

### Schema-Driven Configuration
- **Zod Schemas**: Define structure, validation, and defaults
- **Type Inference**: TypeScript types derived from schemas
- **Environment Mapping**: Automatic env var to config mapping
- **AWS Integration**: Secrets Manager for sensitive data

### Configuration Flow
1. Environment variables loaded
2. AWS Secrets fetched (if configured)
3. Deep merge of configurations
4. Zod validation ensures correctness
5. Typed services provide access

## Queue Architecture

### Queue Design
- **Two-Phase Processing**: Validation queue → Execution queue
- **Job Persistence**: Redis ensures job durability
- **Retry Logic**: Exponential backoff for failed jobs
- **Standardized Format**: Consistent job structure

### Queue Benefits
- **Scalability**: Multiple workers can process jobs
- **Reliability**: Jobs persist through restarts
- **Monitoring**: Queue depth and processing metrics
- **Decoupling**: Producers and consumers independent

## Security Architecture

### Security Layers
1. **API Security**
   - API key authentication
   - Rate limiting
   - CORS configuration
   - Helmet security headers

2. **Data Security**
   - Sensitive data masking in logs
   - AWS Secrets Manager integration
   - Environment variable validation

3. **Blockchain Security**
   - Private key management
   - Transaction validation
   - Prover verification

## Observability Architecture

### Logging
- **Structured Logging**: JSON format with metadata
- **Correlation IDs**: Request tracking across services
- **Context Propagation**: Log context maintained
- **Sensitive Data Masking**: Automatic redaction

### Metrics
- **DataDog Integration**: StatsD protocol metrics
- **Custom Metrics**: Intent processing, queue depth
- **Performance Metrics**: RPC calls, database queries

### Tracing
- **OpenTelemetry**: Distributed tracing
- **Span Propagation**: Parent-child relationships
- **Queue Tracing**: Job execution tracking
- **Context Preservation**: Trace context in async operations

## Extensibility Points

### Adding New Chains
1. Extend base abstract classes
2. Implement chain-specific logic
3. Register in blockchain module
4. Configure in environment

### Adding New Strategies
1. Extend FulfillmentStrategy base
2. Define validation set
3. Implement execution logic
4. Register in module

### Adding New Validations
1. Implement Validation interface
2. Add to strategy validation set
3. Configure parameters in schema

### Adding New Provers
1. Extend BaseProver abstract
2. Implement validation logic
3. Register in ProverService
4. Configure contracts

## Performance Considerations

### Optimization Strategies
- **Connection Pooling**: Reuse database and RPC connections
- **Batch Operations**: Multicall for EVM transactions
- **Parallel Processing**: Multiple queue workers
- **Caching**: Redis for frequently accessed data

### Scalability Patterns
- **Horizontal Scaling**: Stateless design allows multiple instances
- **Queue Distribution**: Redis coordinates work distribution
- **Database Sharding**: MongoDB supports sharding for scale
- **Load Balancing**: Multiple RPC endpoints for redundancy

## Error Handling

### Error Recovery
- **Retry Logic**: Automatic retry with backoff
- **Dead Letter Queue**: Failed jobs after max retries
- **Graceful Degradation**: Partial service availability
- **Circuit Breakers**: Prevent cascading failures

### Error Reporting
- **Structured Errors**: Consistent error format
- **Error Context**: Include relevant metadata
- **Error Tracking**: Integration with monitoring
- **User-Friendly Messages**: API error responses

## Deployment Architecture

### Container Strategy
- **Docker Support**: Full containerization
- **Multi-Stage Builds**: Optimized images
- **Environment Configuration**: Runtime configuration
- **Health Checks**: Kubernetes/ECS compatibility

### High Availability
- **Stateless Services**: No local state storage
- **Database Replication**: MongoDB replica sets
- **Redis Sentinel**: High availability Redis
- **Multi-Region**: Geographic distribution support