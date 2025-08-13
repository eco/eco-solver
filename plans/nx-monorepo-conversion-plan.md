# Eco-Solver NestJS to Nx Monorepo Conversion Plan

## Project Overview

**Eco-Solver** is a sophisticated blockchain solver/filler application for the Eco Routes protocol. It's a complex NestJS application that handles cross-chain liquidity management, intent processing, and blockchain transaction management.

## Current Architecture Analysis

### Core Application Structure (`/src/`)

#### API Layer (`/src/api/`)
- REST controllers: `BalanceController`, `QuoteController`, `IntentInitiationController`
- Implements caching layer with interceptors

#### Domain Modules (Business Logic)
1. **Intent Management** (`/src/intent/`)
   - Core business logic for intent creation, validation, fulfillment
   - Services: `CreateIntentService`, `ValidateIntentService`, `FeasableIntentService`, `FulfillIntentService`
   - Crowd liquidity functionality

2. **Liquidity Management** (`/src/liquidity-manager/`)
   - Complex module with multiple provider integrations
   - Providers: LiFi, CCTP, Hyperlane, Relay, Stargate, Squid, Everclear
   - Queue-based processing with BullMQ

3. **Quote System** (`/src/quote/`)
   - Quote generation and management
   - DTO validation with permit systems (Permit2)
   - MongoDB schema integration

4. **Transaction Management** (`/src/transaction/`)
   - Smart wallet integrations (Kernel, SimpleAccount)
   - Multichain public client services
   - Account abstraction support

#### Infrastructure Modules
1. **Analytics** (`/src/analytics/`) - PostHog integration
2. **Configuration** (`/src/eco-configs/`) - AWS Secrets Manager integration
3. **Job Processing** (`/src/bullmq/`) - Redis-based queue management
4. **Blockchain Integration** (`/src/contracts/`) - Contract definitions and ABIs

#### Shared Infrastructure (`/src/common/`)
- Chains, Errors, Events, Logging, Redis, REST API, Test Utils, Viem utilities

## Proposed Nx Monorepo Structure

### Apps (3 applications)
```
apps/
├── eco-solver-api/          # Main REST API server
├── eco-solver-cli/          # Commander CLI application  
└── eco-solver-worker/       # Background job processor
```

### Libraries (15 focused libraries)

#### Domain Libraries (Business Logic)
```
libs/domain/
├── intent/                  # Intent creation, validation, fulfillment
├── liquidity/               # Multi-provider liquidity management
├── quote/                   # Quote generation and validation
├── balance/                 # Balance tracking and management
└── transaction/             # Smart wallet & transaction handling
```

#### Infrastructure Libraries
```
libs/infrastructure/
├── blockchain/              # Contracts, chains, Viem utilities
├── database/                # MongoDB schemas and connections
├── queue/                   # BullMQ job processing
├── analytics/               # PostHog integration
├── config/                  # AWS Secrets & environment management
└── external-apis/           # LiFi, CCTP, Hyperlane integrations
```

#### Shared Libraries
```
libs/shared/
├── common/                  # Existing /src/common utilities
├── types/                   # TypeScript definitions
├── constants/               # Application constants
├── errors/                  # Custom error handling
└── testing/                 # Test utilities (eco-tester)
```

## Key Benefits of This Structure

### Clear Separation of Concerns
- **Apps**: Different deployment targets (API, CLI, Workers)
- **Domain**: Business logic with clear boundaries
- **Infrastructure**: External integrations and technical concerns
- **Shared**: Common utilities used across the monorepo

### Natural Domain Boundaries Identified
- **Intent Processing**: Self-contained with clear interfaces
- **Liquidity Management**: Complex provider integrations (LiFi, CCTP, etc.)
- **Quote System**: Independent pricing logic with Permit2 validation
- **Transaction Management**: Account abstraction and smart wallet logic

### Reusability & Maintainability
- Shared blockchain utilities across all apps
- Common testing framework for all libraries
- Centralized configuration and error handling
- Independent versioning and testing of components

## Migration Strategy

### Phase 1: Extract Shared Libraries
- Move `/src/common/` to `libs/shared/common/`
- Extract TypeScript types to `libs/shared/types/`
- Create `libs/shared/constants/` for application constants
- Move error handling to `libs/shared/errors/`
- Extract test utilities to `libs/shared/testing/`

### Phase 2: Create Infrastructure Libraries
- Move contracts and blockchain utilities to `libs/infrastructure/blockchain/`
- Create `libs/infrastructure/database/` for MongoDB schemas
- Extract BullMQ to `libs/infrastructure/queue/`
- Move PostHog integration to `libs/infrastructure/analytics/`
- Create `libs/infrastructure/config/` for AWS Secrets management
- Extract third-party APIs to `libs/infrastructure/external-apis/`

### Phase 3: Extract Domain Logic
- Create `libs/domain/intent/` from `/src/intent/`
- Move liquidity management to `libs/domain/liquidity/`
- Extract quote system to `libs/domain/quote/`
- Create `libs/domain/balance/` for balance management
- Move transaction logic to `libs/domain/transaction/`

### Phase 4: Split Applications
- Create `apps/eco-solver-api/` for the main REST API
- Extract CLI functionality to `apps/eco-solver-cli/`
- Create `apps/eco-solver-worker/` for background processing
- Configure proper dependency management between apps and libs

### Phase 5: Optimize Build Pipeline
- Configure Nx caching for faster builds
- Set up proper test strategies for each library
- Optimize Docker builds for monorepo structure
- Configure deployment pipelines for independent app deployment

## Potential Challenges

### Complex Dependencies
- Heavy interdependencies between intent, liquidity, and quote systems
- Careful module boundary design needed to avoid circular dependencies

### Shared State Management
- MongoDB schemas used across multiple domains
- Queue configurations shared between modules

### Configuration Complexity
- Environment-specific configurations need careful library organization
- AWS integration spans multiple concerns

## Implementation Approach

1. **Start with Shared Libraries**: Extract common utilities first to establish foundation
2. **Infrastructure Second**: Move external integrations to focused libraries
3. **Domain Logic Third**: Carefully extract business logic with proper boundaries
4. **Split Applications Last**: Create separate apps once libraries are stable
5. **Optimize Iteratively**: Improve build and deployment processes throughout

## Dependencies Analysis

### Core Framework
- **NestJS**: v10.x - Modern Node.js framework
- **MongoDB/Mongoose**: Document database for intent/quote storage
- **Redis/BullMQ**: Queue management and caching
- **Viem**: Modern Ethereum library for blockchain interactions

### Blockchain Integrations
- **Multi-chain Support**: Ethereum, Arbitrum, Optimism, Base, Polygon, etc.
- **Bridge Protocols**: CCTP, Hyperlane, Stargate
- **DEX Aggregators**: LiFi, Squid, Relay
- **Account Abstraction**: ZeroDev SDK, Permissionless

### External Services
- **AWS**: KMS, Secrets Manager
- **PostHog**: Analytics and feature flags
- **LaunchDarkly**: Feature flag management

This structure leverages the existing modular NestJS architecture while providing better dependency management, deployment flexibility, and development experience through Nx tooling.