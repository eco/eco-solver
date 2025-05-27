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

- **Node.js** v20.14.0 (use [nvm](https://github.com/nvm-sh/nvm))
- **Yarn** v1.22.22 (managed by Corepack)
- **Docker** & **Docker Compose** v3.8+
- AWS credentials (SSO or IAM) for Secrets Manager & KMS access

> Redis & MongoDB can run locally or via Docker (see below).

---

## Setup

### 1. Clone & Install Dependencies

```bash
# Clone repo and enter directory
git clone <repository-url>
cd eco-solver

# Node & Yarn
nvm install 20.14.0
nvm use 20.14.0
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
