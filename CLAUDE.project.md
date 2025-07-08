# ECO-SOLVER PROJECT CONTEXT

## PROJECT OVERVIEW

**eco-solver** is a TypeScript/NestJS service that listens for, validates, and fulfills on-chain intents across multiple EVM chains. It orchestrates BullMQ workers, Redis, MongoDB, AWS KMS signers and more – all wrapped in modular NestJS components.

### Core Purpose

- **Intent lifecycle automation**: create → validate → solve → fulfill
- **Multi-chain support** with secure AWS KMS signing
- **Liquidity aggregation** via LiFi and custom providers
- **Distributed processing** using BullMQ + Redis workers

## TECHNOLOGY STACK

### Core Framework

- **Runtime**: Node.js v20.14.0
- **Framework**: NestJS with TypeScript
- **Package Manager**: Yarn v1.22.22

### Data Layer

- **Database**: MongoDB (via Mongoose)
- **Caching**: Redis with BullMQ for job queues
- **Configuration**: AWS Secrets Manager + local config files

#### MongoDB Database Access

- **Preprod Environment**: Access `eco-solver-pre-prod` database via `mcp__mongodb-preprod__*` tools
- **Production Environment**: Access `eco-solver-prod` database via `mcp__mongodb-prod__*` tools
- Always specify the correct database name when using MongoDB MCP tools

### Blockchain Integration

- **Multi-chain**: viem for EVM interactions
- **Signing**: AWS KMS for secure wallet operations
- **Chains**: Multiple EVM networks via Alchemy RPC/WS

#### Intent Model Terminology

- **IntentSources model**: Can be referred to as "intents" or "intent" in Claude terminal commands
- Collection name in MongoDB: `intentsourcemodels`

#### Database Analysis Tools

- **Query Templates**: `.claude/queries/intent-analysis-queries.md` contains optimized MongoDB aggregation pipelines for intent analysis
- **Common Queries**: Pre-built queries for creator analysis, reward calculations, and performance metrics
- **Usage**: Always check `.claude/queries/` folder for existing query templates before writing new database operations

### Infrastructure

- **Containerization**: Docker + Docker Compose
- **Logging**: Pino JSON logging with health checks
- **Monitoring**: Nest Terminus health checks
- **Feature Flags**: LaunchDarkly

## ARCHITECTURE OVERVIEW

### Main Application Modules (src/app.module.ts)

- `ApiModule` - REST API endpoints
- `BalanceModule` - Wallet balance tracking and management
- `IntentModule` - Core intent processing logic
- `QuoteModule` - Quote generation and management
- `SolverModule` - Solver registration and validation
- `LiquidityManagerModule` - Cross-chain liquidity rebalancing (commented out)
- `ChainMonitorModule` - Blockchain event monitoring
- `ProcessorModule` - BullMQ job processors
- `KmsModule` - AWS KMS integration
- `SignModule` - Transaction signing services

### Key Service Components

- **Intent Processing**: Validates and processes cross-chain intents
- **Balance Management**: Tracks solver wallet balances across chains
- **Quote Engine**: Generates quotes for cross-chain transactions
- **Liquidity Management**: Handles rebalancing across chains via CCTP, Hyperlane, LiFi
- **Chain Monitoring**: Watches for on-chain events and state changes
- **Signing Services**: Secure transaction signing via AWS KMS

## DEVELOPMENT COMMANDS

### Essential Scripts

```bash
# Development
yarn start:dev          # Hot-reload development mode
yarn start              # Compile and run once
yarn build              # Compile TypeScript to dist/

# Code Quality (REQUIRED before commits)
yarn test               # Run all unit tests
yarn format             # Run lint:fix + prettier:fix (REQUIRED)
yarn lint               # ESLint code quality check
yarn prettier           # Code formatting check

# CLI Utilities
yarn cli                # Commander CLI utilities (balance, transfer, etc.)
```

### Docker Development

```bash
# Full stack (API + DBs)
docker compose --profile all up -d

# Only databases (Mongo + Redis)
docker compose --profile db up -d

# Only the NestJS API
docker compose --profile app up --build
```

## PROJECT STRUCTURE

### Core Directories

- `src/api/` - REST API controllers and endpoints
- `src/balance/` - Balance tracking and monitoring services
- `src/intent/` - Intent processing and validation logic
- `src/quote/` - Quote generation and management
- `src/solver/` - Solver registration and filtering
- `src/liquidity-manager/` - Cross-chain liquidity operations
- `src/chain-monitor/` - Blockchain event monitoring
- `src/bullmq/` - Job queue processors and utilities
- `src/kms/` - AWS KMS integration services
- `src/sign/` - Transaction signing services
- `src/contracts/` - Smart contract interfaces and ABIs
- `src/common/` - Shared utilities and helpers

### Configuration

- `config/` - Environment-specific configuration files
- `docker-compose.yml` - Docker services configuration
- `CLAUDE.md` - Planning framework and execution directives
- `CLAUDE.project.md` - This project context file
- `.claude/queries/` - Reusable database queries and analysis templates

## SECURITY PRACTICES

### Defensive Security Implementation

- **KMS-based signing**: All transactions signed via AWS KMS
- **Secret management**: Sensitive config via AWS Secrets Manager
- **Input validation**: Comprehensive validation throughout
- **Error handling**: Proper error boundaries and logging
- **No secret exposure**: Never log or commit secrets/keys

### Authentication & Authorization

- AWS SSO/IAM for cloud resource access
- Feature flags via LaunchDarkly for controlled rollouts
- Health checks and monitoring via Nest Terminus

## TESTING STRATEGY

### Test Coverage Requirements

- **Unit tests**: 100% coverage for all new functionality
- **Integration tests**: Critical path validation
- **Test commands**: `yarn test`, `yarn test:cov`, `yarn test:watch`
- **Pre-commit**: ALWAYS run `yarn test && yarn format` before commits

### Test Organization

- Tests co-located with source files (`.spec.ts` suffix)
- Dedicated test utilities in `src/common/test-utils/`
- MongoDB integration tests via `@shelf/jest-mongodb`

## GIT WORKFLOW

### Branch Naming Convention

Format: `<type>/<component>/<description>`

- Types: `feat`, `fix`, `refactor`, `docs`, `test`, `perf`, `security`
- Components: `auth`, `balance`, `intent`, `quote`, `solver`, etc.
- Examples: `feat/balance/add-multi-chain-support`, `fix/intent/resolve-validation-error`

### Commit Standards

```
<type>(<scope>): <concise description>

- Completed subtask X.Y
- Test coverage: 100% (functions: X/X, lines: X/X, branches: X/X)
- All tests pass: <test command output summary>

🤖 Generated with [Claude Code](https://claude.ai/code)
```

## CURRENT DEVELOPMENT CONTEXT

### Active Branch

- **Branch**: `ED-5524-max-surplus`
- **Status**: Modified `src/app.module.ts`
- **Focus**: Balance update logic and token filtering improvements

### Recent Changes

- Fixing balance update logic and removing explicit timestamp
- Update filtering on token decimals
- Fix duplicate errors in BalanceRecordRepository
- Adding balanceRpcUpdate to default configs
- Merged balance monitor module to balance module
- Added BalanceChangeSchema and BalanceRecordSchema

## API ENDPOINTS

### Core Endpoints

- `GET /api/v1/balance` - Get solver wallet balances
- `POST /api/v1/quote` - Request cross-chain quotes
- Swagger UI available at `http://localhost:3000/api`

### Health Monitoring

- Health checks via Nest Terminus
- Balance indicator monitoring
- Redis and MongoDB health indicators
- Git commit tracking

## DEPLOYMENT CONSIDERATIONS

### Environment Management

- Configuration via `NODE_ENV` (development, staging, production)
- AWS profile configuration required for KMS access
- Docker profiles for different deployment scenarios

### Performance Optimization

- BullMQ for distributed job processing
- Redis caching for frequently accessed data
- Mongoose connection pooling for MongoDB
- Parallel processing capabilities via BatchTool patterns
