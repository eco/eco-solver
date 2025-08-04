# Blockchain Intent Solver

A high-performance, multi-chain blockchain intent solving system built with NestJS. This system listens for intents on multiple blockchains (EVM and Solana), validates them, and executes fulfillment transactions across chains.

## 🚀 Features

- **Multi-Chain Support**: Multiple EVM networks (Ethereum, Polygon, etc.) and Solana
- **Modular Architecture**: Clean separation of concerns with NestJS modules
- **Queue-Based Processing**: Reliable intent processing with BullMQ and Redis
- **Multiple Fulfillment Strategies**: Standard, CrowdLiquidity, NativeIntents, NegativeIntents, and Rhinestone
- **Pluggable Validation Framework**: Reusable validation classes with immutable configurations
- **On-Chain Funding Verification**: Validates intents are funded on the IntentSource contract before processing
- **Type-Safe Configuration**: Schema-driven configuration with Zod validation
- **AWS Integration**: Secure secrets management with AWS Secrets Manager
- **Docker Ready**: Full containerization support for easy deployment
- **Extensible Design**: Easy to add new chains, fulfillment strategies, and validations

## 📋 Prerequisites

- Node.js 18+ 
- PNPM 8.15.0+
- Redis 6+
- MongoDB 5+
- Docker & Docker Compose (optional)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd blockchain-intent-solver
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start required services**
   ```bash
   # Using Docker Compose
   docker-compose up -d redis mongodb

   # Or install locally
   # - Redis: https://redis.io/download
   # - MongoDB: https://www.mongodb.com/docs/manual/installation/
   ```

## 🏃‍♂️ Running the Application

### Development
```bash
pnpm run start:dev
```

### Production
```bash
pnpm run build
pnpm run start:prod
```

### Docker
```bash
docker-compose up -d
```

## 🏗️ Architecture

### Module Structure

```
src/
├── common/                 # Shared abstractions and interfaces
│   ├── abstractions/      # Base classes for chain listeners and executors
│   ├── constants/         # Application constants
│   └── interfaces/        # TypeScript interfaces (including Intent)
├── config/                # Configuration and validation
│   ├── config.schema.ts   # Zod schema for configuration
│   └── configuration.ts   # Configuration factory
└── modules/               # Core application modules
    ├── config/           # Configuration module with typed services
    ├── intents/          # Intent persistence and management
    ├── queue/            # Queue management with BullMQ
    ├── blockchain/       # Blockchain integration module
    │   ├── evm/          # EVM-specific implementation
    │   │   ├── listeners/# EVM blockchain event listeners (self-initializing)
    │   │   └── wallets/  # EVM wallet implementations
    │   └── svm/          # Solana-specific implementation
    │       └── listeners/# Solana blockchain event listeners (self-initializing)
    ├── fulfillment/      # Intent validation and fulfillment logic
    │   ├── strategies/   # Multiple fulfillment strategies
    │   └── validations/  # Pluggable validation framework
    └── prover/           # Route validation with multiple prover types
```

### Processing Flow

1. **Listen**: Blockchain listeners (self-initializing) monitor chain events for new intents
2. **Submit**: Listeners call FulfillmentService.submitIntent() for centralized processing
3. **Store**: FulfillmentService persists intents to MongoDB
4. **Queue**: FulfillmentService determines strategy and adds to fulfillment queue
5. **Validate**: Selected strategy validates intents using its immutable validation set
6. **Execute**: Strategy-specific execution logic performs transactions on target chains
7. **Update**: Intent status is updated throughout the process

### Intent Structure

The system uses a structured Intent format with Viem types:

```typescript
interface Intent {
  intentId: string;
  reward: {
    prover: Address;
    creator: Address;
    deadline: bigint;
    nativeValue: bigint;
    tokens: {
      amount: bigint;
      token: Address;
    }[];
  };
  route: {
    source: bigint;        // Source chain ID
    destination: bigint;   // Destination chain ID
    salt: Hex;
    inbox: Address;
    calls: {
      data: Hex;
      target: Address;
      value: bigint;
    }[];
    tokens: {
      amount: bigint;
      token: Address;
    }[];
  };
  status: IntentStatus;
}
```

## ⚙️ Configuration

The application uses a schema-driven configuration system. See [Configuration Guide](src/modules/config/README.md) for detailed documentation.

### Quick Configuration Example

```bash
# Application
NODE_ENV=development
PORT=3000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/intent-solver

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# EVM Configuration
EVM_PRIVATE_KEY=0x...
# Network configuration (arrays)
EVM_NETWORKS_0_CHAIN_ID=1
EVM_NETWORKS_0_RPC_URLS_0=https://eth-mainnet.g.alchemy.com/v2/your-key
EVM_NETWORKS_0_INTENT_SOURCE_ADDRESS=0x...
EVM_NETWORKS_0_INBOX_ADDRESS=0x...
EVM_NETWORKS_0_FEE_LOGIC_BASE_FLAT_FEE=1000000000000000
EVM_NETWORKS_0_FEE_LOGIC_SCALAR_BPS=100

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_SECRET_KEY=[...]
SOLANA_PROGRAM_ID=...

# Fulfillment Configuration
FULFILLMENT_DEFAULT_STRATEGY=standard
FULFILLMENT_STRATEGIES_STANDARD_ENABLED=true
FULFILLMENT_STRATEGIES_CROWD_LIQUIDITY_ENABLED=true

# AWS Secrets Manager (optional)
# Note: AWS secrets are enabled automatically when AWS_SECRET_NAME is provided
AWS_REGION=us-east-1
AWS_SECRET_NAME=blockchain-intent-solver-secrets
```

## 💼 Wallet System

The EVM module supports multiple wallet types through a modular architecture:

### Supported Wallet Types

1. **BasicWallet** - Standard EOA (Externally Owned Account)
   - Uses private keys for transaction signing
   - Supports batch operations via multicall3
   - Default wallet type if none specified

2. **KernelWallet** - Smart Account implementation
   - Supports multiple signer types (EOA, KMS)
   - Advanced features like session keys and modules
   - Batch operations via smart contract

### Wallet Configuration

```bash
# Basic wallet (uses global private key by default)
EVM_WALLETS_BASIC_PRIVATE_KEY=0x...  # Optional: override global key

# Kernel wallet with EOA signer
EVM_WALLETS_KERNEL_SIGNER_TYPE=eoa
EVM_WALLETS_KERNEL_SIGNER_PRIVATE_KEY=0x...

# Kernel wallet with AWS KMS signer
EVM_WALLETS_KERNEL_SIGNER_TYPE=kms
EVM_WALLETS_KERNEL_SIGNER_REGION=us-east-1
EVM_WALLETS_KERNEL_SIGNER_KEY_ID=...
```

### Module Architecture

Each wallet type is encapsulated in its own NestJS module:
- `BasicWalletModule` - Provides BasicWalletFactory
- `KernelWalletModule` - Provides KernelWalletFactory

Wallet factories only require a `chainId` to create instances, retrieving all configuration internally.

## 🛡️ Validation Framework

The system includes a comprehensive validation framework that ensures intents are properly validated before execution:

### Available Validations

1. **IntentFundedValidation** - Verifies the intent is funded on the IntentSource contract
2. **FundingValidation** - Checks creator has sufficient token/native balances
3. **RouteTokenValidation** - Validates token addresses in the route
4. **RouteCallsValidation** - Validates call targets and data
5. **RouteAmountLimitValidation** - Enforces route-specific amount limits
6. **ExpirationValidation** - Ensures deadline hasn't passed
7. **ChainSupportValidation** - Verifies source and destination chains are supported
8. **ProverSupportValidation** - Validates the route with configured provers
9. **ExecutorBalanceValidation** - Ensures executor has sufficient funds
10. **Fee Validations** - Strategy-specific fee requirements (Standard, CrowdLiquidity, Native)

### Validation Execution

Each fulfillment strategy defines its own immutable set of validations that are executed sequentially before processing an intent. All strategies include the `IntentFundedValidation` to ensure on-chain funding verification.

## 🔧 Development

### Code Style

- **Linting**: `pnpm run lint`
- **Formatting**: `pnpm run format`
- **Type Checking**: Built into the development workflow

### Testing

```bash
# Unit tests
pnpm run test

# Test coverage
pnpm run test:cov

# E2E tests
pnpm run test:e2e
```

### Adding a New Chain

1. Create a new listener extending `BaseChainListener`:
   ```typescript
   export class MyChainListener extends BaseChainListener {
     constructor(
       private myChainConfig: MyChainConfigService,
       private fulfillmentService: FulfillmentService,
       private fulfillmentConfigService: FulfillmentConfigService,
     ) {
       super();
     }
     // Implement abstract methods
   }
   ```

2. Create a new executor extending `BaseChainExecutor`:
   ```typescript
   export class MyChainExecutor extends BaseChainExecutor {
     // Implement abstract methods
   }
   ```

3. Register in blockchain module with FulfillmentModule import (use forwardRef if needed)

### Adding New Configuration

1. Update the Zod schema in `src/config/config.schema.ts`
2. Create a typed configuration service
3. Environment variables are automatically mapped from the schema

See [Configuration Guide](src/modules/config/README.md) for details.

## 🚀 Deployment

### Docker Deployment

```bash
# Build the image
docker build -t blockchain-intent-solver .

# Run with docker-compose
docker-compose up -d
```

### AWS ECS/Kubernetes

The application is designed to run in containerized environments:
- Stateless design allows horizontal scaling
- Health checks available at `/health`
- Graceful shutdown handling
- Environment-based configuration

### Production Considerations

1. **Secrets Management**: Use AWS Secrets Manager for sensitive data
2. **Monitoring**: Implement logging and metrics collection
3. **High Availability**: Run multiple instances with Redis for queue coordination
4. **Database**: Use MongoDB replica sets for reliability
5. **Security**: 
   - Never expose private keys in logs
   - Use least-privilege IAM roles
   - Enable SSL/TLS for all connections

## 📚 Documentation

- [Configuration Guide](src/modules/config/README.md) - Detailed configuration documentation
- [CLAUDE.md](../../../CLAUDE.md) - Project guidelines and conventions
- [API Documentation](docs/api.md) - Coming soon

## 🤝 Contributing

1. Follow the coding standards in [CLAUDE.md](../../../CLAUDE.md)
2. Write tests for new features
3. Update documentation as needed
4. Submit PR with clear description

## 📄 License

MIT

## 🔗 Related Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Viem Documentation](https://viem.sh/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)

## 🐛 Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Ensure Redis is running: `redis-cli ping`
   - Check `REDIS_HOST` and `REDIS_PORT` in configuration

2. **MongoDB Connection Failed**
   - Verify MongoDB is running: `mongosh --eval "db.version()"`
   - Check `MONGODB_URI` format and credentials

3. **Configuration Validation Error**
   - Review error message for missing/invalid configuration
   - Check environment variables match schema requirements
   - See [Configuration Guide](src/modules/config/README.md)

4. **Queue Processing Issues**
   - Check Redis connection
   - Verify queue names match between producers and consumers
   - Review logs for processing errors

### Debug Mode

Enable debug logging:
```bash
DEBUG=* pnpm run start:dev
```

## 📞 Support

For issues and questions:
- Check existing issues in the repository
- Review documentation thoroughly
- Create a new issue with detailed information