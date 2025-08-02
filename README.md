# Blockchain Intent Solver

A high-performance, multi-chain blockchain intent solving system built with NestJS. This system listens for intents on multiple blockchains (EVM and Solana), validates them, and executes fulfillment transactions across chains.

## 🚀 Features

- **Multi-Chain Support**: EVM (Ethereum, Polygon, etc.) and Solana
- **Modular Architecture**: Clean separation of concerns with NestJS modules
- **Queue-Based Processing**: Reliable intent processing with BullMQ and Redis
- **Type-Safe Configuration**: Schema-driven configuration with Zod validation
- **AWS Integration**: Secure secrets management with AWS Secrets Manager
- **Docker Ready**: Full containerization support for easy deployment
- **Extensible Design**: Easy to add new chains and fulfillment strategies

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
│   └── interfaces/        # TypeScript interfaces
├── config/                # Configuration and validation
│   ├── config.schema.ts   # Zod schema for configuration
│   └── configuration.ts   # Configuration factory
└── modules/               # Core application modules
    ├── config/           # Configuration module with typed services
    ├── intents/          # Intent persistence and management
    ├── queue/            # Queue management with BullMQ
    ├── on-chain-listener/# Blockchain event listeners
    ├── fulfillment/      # Intent validation and fulfillment logic
    └── execution/        # Transaction execution on target chains
```

### Processing Flow

1. **Listen**: On-chain listeners monitor blockchain events for new intents
2. **Store**: Intents are persisted to MongoDB for tracking
3. **Queue**: Valid intents are added to the fulfillment queue
4. **Validate**: Fulfillment service validates intents against strategies
5. **Execute**: Execution service performs transactions on target chains
6. **Update**: Intent status is updated throughout the process

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
EVM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-key
EVM_CHAIN_ID=1
EVM_PRIVATE_KEY=0x...
EVM_INTENT_SOURCE_ADDRESS=0x...
EVM_INBOX_ADDRESS=0x...

# Solana Configuration
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_SECRET_KEY=[...]
SOLANA_PROGRAM_ID=...

# AWS Secrets Manager (optional)
USE_AWS_SECRETS=false
AWS_REGION=us-east-1
AWS_SECRET_NAME=blockchain-intent-solver-secrets
```

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
     // Implement abstract methods
   }
   ```

2. Create a new executor extending `BaseChainExecutor`:
   ```typescript
   export class MyChainExecutor extends BaseChainExecutor {
     // Implement abstract methods
   }
   ```

3. Register in respective modules and add configuration

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