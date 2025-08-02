# Blockchain Intent-Solving System

A modular NestJS server for cross-chain intent solving, supporting EVM and Solana blockchains.

## Features

- Multi-chain support (EVM via Viem, Solana via @solana/web3.js)
- Modular architecture with clear separation of concerns
- Queue-based processing with Redis and BullMQ
- MongoDB for intent storage
- Docker support for easy deployment
- Extensible design for adding new chains

## Prerequisites

- Node.js 20+
- PNPM 8.15.0+
- Docker and Docker Compose
- MongoDB (or use Docker)
- Redis (or use Docker)

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy `.env.example` to `.env` and configure your environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start the services:
   ```bash
   # Using Docker
   docker-compose up -d

   # Or run locally
   pnpm run start:dev
   ```

## Architecture

The system consists of several key modules:

- **OnChainListenerModule**: Listens for intent events on multiple blockchains
- **FulfillmentModule**: Validates intents and determines if they can be fulfilled
- **ExecutionModule**: Executes intents on the target blockchain
- **IntentsModule**: Manages intent storage in MongoDB
- **QueueModule**: Handles job queuing with Redis and BullMQ

## Configuration

All configuration is managed through environment variables. See `.env.example` for required variables.

## Development

```bash
# Run in development mode
pnpm run start:dev

# Build for production
pnpm run build

# Run tests
pnpm run test

# Lint code
pnpm run lint
```

## Deployment

The project includes Docker configuration for easy deployment:

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f app
```

## Adding New Chains

To add support for a new blockchain:

1. Create a new listener in `src/modules/on-chain-listener/listeners/`
2. Create a new executor in `src/modules/execution/executors/`
3. Extend the base abstract classes
4. Register in the respective services

## License

MIT