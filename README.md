# eco-solver

eco-solver is a TypeScript / NestJS service that _listens for_, _validates_, and _fulfils_ **on-chain intents** across multiple EVM chains. It orchestrates BullMQ workers, Redis, MongoDB, AWS KMS signers and more – all wrapped in modular NestJS components.

---

## Key Features

- **Intent life-cycle automation** – create ⇒ validate ⇒ solve ⇒ fulfil.
- **Multi-chain support** through `viem` + Alchemy RPC / WS endpoints.
- **Secure signing** via AWS KMS (EOA & ERC-4337 smart-wallet accounts).
- **Liquidity aggregation / rebalancing** powered by LiFi & custom providers.
- **Distributed queues** with BullMQ + Redis; workers scale independently.
- **Observability** – Pino JSON logging, Nest Terminus health-checks, Feature-flags (LaunchDarkly).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [MCP (Model Context Protocol) Integrations](#mcp-model-context-protocol-integrations)
- [Setup](#setup)
  - [1. Clone & Install Dependencies](#1-clone--install-dependencies)
  - [2. AWS Configuration](#2-aws-configuration)
  - [3. Environment Variables](#3-environment-variables)
  - [4. Docker Compose Services](#4-docker-compose-services)
  - [5. Running the Application](#5-running-the-application)
  - [6. Running Tests](#6-running-tests)
- [Typical Yarn Scripts](#typical-yarn-scripts)
- [API Quick-Start](#api-quick-start)
- [Contributing](#contributing)

---

## Prerequisites

- **Node.js** v20.19.0 (use [nvm](https://github.com/nvm-sh/nvm))
- **Yarn** v1.22.22 (managed by Corepack)
- **Docker** & **Docker Compose** v3.8+
- AWS credentials (SSO or IAM) for Secrets Manager & KMS access

> Redis & MongoDB can run locally or via Docker (see below).

## MCP (Model Context Protocol) Integrations

This project includes MCP server integrations for enhanced development tooling:

### MongoDB MCP

- **Development**: Connects to local MongoDB instance
- **Production**: Connects to production MongoDB (requires AWS VPN connection)
- **Configuration**: Uses `.mcp.json` with connection strings from environment variables

### GitHub MCP

- **Purpose**: GitHub repository management and operations
- **Requirements**: GitHub Personal Access Token must be set as `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable
- **Usage**: Enables GitHub operations through MCP tools

### MCP Setup for New Git Clones

When setting up this repository for the first time, follow these steps to configure MCP services:

#### Prerequisites

1. **AWS VPN Connection**: Must be active and connected for production/preprod database access
2. **Docker**: Must be running locally for GitHub MCP service
3. **Environment Variables**: Required for service authentication
4. **env-cmd**: Tool for loading environment variables from config files (install globally or use via npx)

#### Step-by-Step Setup

1. **Verify Prerequisites**:

   ```bash
   # Check AWS VPN is connected (verify internal network access)
   # Check Docker is running
   docker --version

   # Install env-cmd globally (optional - can also use npx)
   npm install -g env-cmd
   # OR verify npx can access it
   npx env-cmd --version
   ```

2. **Configure Environment Variables**:

   ```bash
   # Set GitHub Personal Access Token for GitHub MCP
   export GITHUB_PERSONAL_ACCESS_TOKEN=your_github_token_here

   # Verify environment files exist (these should be in the repo)
   ls -la .env*
   # Should show: .env-cmdrc, .env.preprod, .env.prod
   ```

3. **Test MCP Services**:
   The following services are configured in `.mcp.json`:
   - **mongodb-preprod**: Uses `env-cmd -e preprod` to load preprod MongoDB connection from `.env-cmdrc`
   - **mongodb-prod**: Uses `env-cmd -e prod` to load production MongoDB connection from `.env-cmdrc`
   - **github**: Uses Docker to run GitHub MCP server with your personal access token

   The `env-cmd` tool reads environment-specific configurations from `.env-cmdrc` and applies them before running the `mongodb-mcp-server`.

4. **Verify Connection Strings**:
   Connection strings are automatically loaded from:
   - `.env-cmdrc` (JSON format with preprod/prod environments)
   - `.env.preprod` and `.env.prod` (traditional .env format)

   These files contain the MongoDB Atlas connection strings for the MCP user.

#### Troubleshooting

- **MongoDB Connection Issues**: Ensure AWS VPN is active and you can reach internal MongoDB clusters
- **GitHub MCP Issues**: Verify `GITHUB_PERSONAL_ACCESS_TOKEN` is set and Docker is running
- **Service Not Found**: Check that `mongodb-mcp-server` is available via `npx -y mongodb-mcp-server`

#### Security Notes

- MongoDB credentials are read-only MCP user credentials, not production write access
- GitHub token should have minimal required permissions for repository operations
- All MCP services run locally and do not expose external endpoints

The MCP configuration is defined in `.mcp.json` at the project root.

---

## Setup

### 1. Clone & Install Dependencies

```bash
# Clone repo and enter directory
git clone <repository-url>
cd eco-solver

# Node & Yarn
nvm install 20.19.0
nvm use 20.19.0
corepack enable

# Install packages
yarn install
```

### 2. AWS Configuration

eco-solver pulls sensitive config from Secrets Manager. The easiest way locally is AWS SSO:

```bash
aws configure sso  # choose your SSO profile, e.g. eco-dev
aws sso login --profile eco-dev
export AWS_PROFILE=eco-dev
```

### 3. Environment Variables

Configuration values are merged from multiple sources:

1. `config/default.json` – sane defaults
2. `config/<NODE_ENV>.json` – per-environment overrides
3. **Env vars** (highest priority)
4. **AWS Secrets Manager** JSON – fetched on boot via `EcoConfigService`

See `config/` folder for full list & structure.

### 4. Docker Compose Services

Compose profiles are **required** because every service in `docker-compose.yml` is associated with one:

| Profile | Starts                    | When to use                                                                                           |
| ------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `db`    | `mongodb`, `redis`        | Use if you want to run the Node server on your host machine but still rely on local Docker databases. |
| `app`   | `app`                     | Useful when you already have Mongo/Redis running elsewhere.                                           |
| `all`   | `app`, `mongodb`, `redis` | Complete stack for one-shot testing.                                                                  |

> If you omit `--profile …` no service will be started - this is the behaviour when every service is gated by a profile.

Example flows:

```bash
# ▸ Full stack (API + DBs) in the background
docker compose --profile all up -d

# ▸ Only Mongo & Redis
docker compose --profile db up -d

# ▸ Only the NestJS API (assumes DBs available)
docker compose --profile app up --build   # --build to pick up local code changes

# Stop everything
docker compose --profile all down
```

Internally the `app` service mounts `./src` and `./config` as bind-volumes and runs `yarn start:dev`, so code changes are live-reloaded.

A few **environment variables** are forwarded into the container via `docker-compose.yml`:

```yaml
AWS_PROFILE: ${AWS_PROFILE}         # whichever profile you logged in with (see AWS section)
NODE_ENV: ${NODE_ENV:-development}  # environment used to run
NODE_CONFIG: | { ... }              # in-container overrides for DB / Redis
```

Make sure you export `AWS_PROFILE` in your shell before launching compose so the container can load credentials from the mounted `~/.aws` folder.

### 5. Running the Application

```bash
yarn start:dev   # Hot-reload dev mode
yarn start       # Compile & run once
```

### 6. Running Tests

```bash
yarn test        # all unit tests
yarn test --watch
```

---

## Typical Yarn Scripts

| Script                           | Purpose                                                        |
| -------------------------------- | -------------------------------------------------------------- |
| `yarn build`                     | Compile TypeScript into `dist/`                                |
| `yarn cli`                       | Invoke commander CLI utilities (balance check, transfer, etc.) |
| `yarn lint` / `lint:fix`         | ESLint code quality                                            |
| `yarn prettier` / `prettier:fix` | Code formatting                                                |
| `yarn test:cov`                  | Unit-test coverage report                                      |

---

## API Quick-Start

Once the server is up (`localhost:3000` by default):

```bash
# Get balances for all solver wallets (flattened JSON)
curl "http://localhost:3000/api/v1/balance?flat=true"

# Request a quote (payload abbreviated)
curl -X POST http://localhost:3000/api/v1/quote \
     -H 'Content-Type: application/json' \
     -d '{
           "sourceChain": 1,
           "destChain": 137,
           "tokenIn": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606e48",
           "amount": "1000000"
         }'
```

Swagger UI is auto-generated at `http://localhost:3000/api`
