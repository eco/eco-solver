# Eco Solver

## 1. High-Level Purpose

`eco-solver` is a **NestJS** application that automates the life-cycle of "intents" – high-level descriptions of what a user wants to achieve on-chain (for example _«move 1 USDC from chain A to chain B»_). The system figures out **how** to execute those intents by:

1. Fetching quotes & liquidity options.
2. Selecting/validating the best execution route.
3. Building & signing the required transactions across multiple chains.
4. Submitting the transactions and tracking their finality.

Under the hood the project combines:

- **BullMQ/Redis** – distributed job queues.
- **MongoDB (Mongoose)** – persistence of long-lived entities (rebalance runs, intent source metadata …).
- **Viem & Alchemy** – blockchain connectivity.
- **AWS KMS** – secure transaction signing.
- **Pino** logging + structured `EcoLogMessage` helpers.

Everything is packaged into regular NestJS modules so features can be composed/injected easily.

---

## 2. Module Catalogue (`src/`)

Below is a list of what each top-level folder currently does and how they interact.

| Folder                  | Role                                                                                                                                                                                                                 | Key Providers / Exports                                                   | Down-stream Deps                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| **`api`**               | Thin HTTP façade (REST). Exposes `/balance` and `/quote` endpoints and returns JSON-serialised DTOs.                                                                                                                 | `BalanceController`, `QuoteController`                                    | Balance, Quote                                   |
| **`balance`**           | Reads & caches solver wallets' token balances (ERC-20 only, 6 decimals). Listens to on-chain transfer events (via `EthWebsocketProcessor`) to keep an in-memory cache fresh.                                         | `BalanceService`, `BalanceWebsocketService`                               | Transaction, BullMQ, Cache                       |
| **`bullmq`**            | Helper to register queues/flows with redis options derived from `EcoConfig`. Sub-folder `processors` holds Worker implementations (e.g. `solve-intent.processor.ts`, `interval.processor.ts`).                       | `initBullMQ`, individual `Processor` classes                              | Many                                             |
| **`chain-monitor`**     | Periodic reconciliation against the source chain to ensure database & queue state matches reality; also derives missing events.                                                                                      | `ChainSyncService`                                                        | Intent, Watch, Transaction                       |
| **`commander`**         | CLI / scripts (balance check, safe tx, transfer). _Not used at runtime_ but useful for ops.                                                                                                                          | Stand-alone commands                                                      | —                                                |
| **`common`**            | Shared building blocks – error types, logging wrappers, Alchemy helpers, chain definitions, redis utils, viem wrappers, etc.                                                                                         | numerous                                                                  | :all                                             |
| **`contracts`**         | ABIs and log/topic decoders generated for relevant smart-contracts. Used by Intent, Watch, Balance services.                                                                                                         | `decodeTransferLog`, `IntentCreatedLog` types                             | Intent, Balance, Watch                           |
| **`decoder`**           | Generic call-data & log decoding utilities.                                                                                                                                                                          | —                                                                         | Intent, Prover                                   |
| **`eco-configs`**       | Centralised configuration service (`EcoConfigService`) – merges `.env`, remote AWS SM, JSON files. Exposes redis, mongoose, logging, solver wallets, etc.                                                            | `EcoConfigModule`, `EcoConfigService`                                     | All runtime modules                              |
| **`fee`**               | Fee estimation & gas price helpers for multi-chain execution.                                                                                                                                                        | `FeeService`                                                              | Transaction                                      |
| **`flags`**             | Feature-flags & runtime toggles used during roll-outs.                                                                                                                                                               | `FlagsService`                                                            | Intent, Liquidity-manager                        |
| **`health`**            | `/health` endpoint + custom `HealthIndicator`s (redis, mongoose, alchemy, etc.)                                                                                                                                      | `HealthModule`                                                            | —                                                |
| **`indexer`**           | Lightweight REST client that queries the external Eco indexer for batched withdrawals and send-batch data.                                                                                                           | `IndexerService`, `IndexerModule`                                         | Intent-processor                                 |
| **`intent`**            | Core domain logic for intent life-cycle (CreateIntentService, ValidateIntentService, FeasableIntentService, FulfillIntentService; helper utils & Mongoose schema).                                                   | Listed services, `IntentModule`                                           | Balance, Transaction, Solver, Prover, Fee, Flags |
| **`intent-processor`**  | BullMQ _producers_ that push jobs to **`solve-intent.processor.ts`** and friends. Also holds job-specific DTOs & queue definitions.                                                                                  | `processors`, `queues`, `jobs`                                            | Intent                                           |
| **`interceptors`**      | Global NestJS interceptors: `BigIntToStringInterceptor` and Pino error transformer.                                                                                                                                  | —                                                                         | App bootstrap                                    |
| **`intervals`**         | Cron-like periodic tasks registered as BullMQ repeatable jobs (e.g. rebalance triggers).                                                                                                                             | `IntervalModule`, `IntervalProcessor`                                     | Liquidity-manager, Chain-monitor                 |
| **`kms`**               | AWS KMS signer abstraction; supports EOA & smart-wallet signers.                                                                                                                                                     | `KmsService`, `KmsAccount`                                                | Sign                                             |
| **`liquidity-manager`** | Keeps solver wallets liquid & fetches downstream swap/bridge quotes.<br>Maintains a `Rebalance` collection (Mongo); integrates with providers (LiFi, ...); Batch jobs via BullMQ (`eco-protocol-intents.processor`). | `LiquidityManagerService`, `LiFiProviderService`, `LiquidityManagerQueue` | Balance, Transaction, Flags, Quote               |
| **`nest-redlock`**      | Distributed lock helper around `redlock` package. Prevents double-processing across workers.                                                                                                                         | `NestRedlockService`                                                      | Intent, Liquidity-manager                        |
| **`prover`**            | ZK-/cryptographic proof utilities (receipt verification etc.).                                                                                                                                                       | `ProverService`                                                           | Intent                                           |
| **`quote`**             | Aggregates order-routing & quoting; delegates heavy lifting to Liquidity-manager provider(s). Exposes REST `/quote`. Encapsulates domain errors.                                                                     | `QuoteService`, DTOs                                                      | Liquidity-manager, Flags                         |
| **`sign`**              | High-level abstraction over different signing back-ends: KMS, local wallet, etc.                                                                                                                                     | `SignModule`                                                              | Transaction                                      |
| **`solver`**            | Houses intent validation filters (e.g. `ValidSmartWalletService`).                                                                                                                                                   | listed service                                                            | Intent                                           |
| **`transaction`**       | Blockchain client abstractions (KernelAccountClientService, SimpleAccountClientService, WalletClientDefaultSignerService, ViemMultichainClientService).                                                              | services above, `TransactionModule`                                       | Intent, Liquidity-manager, Balance               |
| **`transforms`**        | Validation pipes / DTO transforms.                                                                                                                                                                                   | —                                                                         | API                                              |
| **`utils`**             | Generic helpers (`bigint`, type guards, etc.).                                                                                                                                                                       | —                                                                         | Widespread                                       |
| **`watch`**             | Reactive chain listeners: `watch-create-intent.service.ts` subscribes to `IntentCreated` events; `watch-fulfillment.service.ts` listens for fulfillment; interacts via Redis & Viem WS.                              | listed services, `WatchModule`                                            | Intent, Balance, Chain-monitor                   |

---

## 3 Primary Work-Flows

### 3.1 Quote ➜ Intent ➜ Fulfilment

```
User POST /quote     ────────► QuoteService (calculates route using LiquidityManager)
                                        │
                                        ▼
                             returns QuoteIntentDataDTO
                                        │
User submits tx that emits IntentCreated on-chain ══════╗
                                                        ▼
WatchCreateIntentService (WS sub) ─┬─► BullMQ job (create_intent)
                                   │
SolveIntentProcessor (queue worker)│
  ├── CreateIntentService  (persist + sanity)
  ├── ValidateIntentService (signature, funds, …)
  ├── FeasableIntentService (quote still valid?)
  └── FulfillIntentService  (build & submit bundle via TransactionModule)
                                   │
                                   ▼
On-chain fulfillment events ◄─────── WatchFulfillmentService
```

### 3.2 Liquidity Rebalancing

1. `IntervalProcessor` schedules periodic _rebalance_ jobs.
2. `LiquidityManagerProcessor` calls provider(s) for cheapest route.
3. Transactions built via `TransactionModule`, signed through KMS and sent.
4. Balances updated via WS → `BalanceService`.

### 3.3 Withdrawal Batching / Rewards Rebalance

Every solver wallet might accrue small rewards (e.g. bridge fees, protocol incentives) that need to be **withdrawn & re-balanced in batches** to keep gas costs low.

```
Interval (configured in EcoConfig) ──► IntentProcessorQueue.startWithdrawalsCronJobs()
                                         │
                                         ▼
       CheckWithdrawalsCronJob (BullMQ repeatable job)
                                         │
                                         ▼
IntentProcessorService.getNextBatchWithdrawals()
  ├─ calls IndexerService.getNextBatchWithdrawals()  <-- Fetch list from off-chain indexer
  ├─ groups & chunks withdrawals per source chain
  └─ queue.addExecuteWithdrawalsJobs(jobsData)        <-- enqueue ExecuteWithdrawals jobs
                                         │
                                         ▼
ExecuteWithdrawsJob (worker) ──► IntentProcessorService.executeWithdrawals()
                                         │   prepares batched tx(s) via TransactionModule
                                         ▼
                                     On-chain `batchWithdraw` tx
                                         │
                                         ▼
                BalanceService (WS) updates local balances
```

Key points

- Uses **BullMQ job-scheduler** `CheckWithdrawalsCronJobManager` to poll at a fixed interval.
- Batches are limited by `config.withdrawals.chunkSize` to stay within gas / contract limits.
- Actual transaction crafting & signing happens once per batch through the existing `TransactionModule` / KMS signer.
- After a successful send, the WS listeners (EthWebsocketProcessor) update the in-memory balance cache, keeping the solver's view of funds in sync.

### 3.4 Retry Infeasible Intents

Some intents may fail the first feasibility check (e.g. funds temporarily unavailable).
A periodic **Retry‐Infeasible‐Intents** interval job gives them additional chances before they expire:

```
IntervalModule bootstrap ► RetryInfeasableIntentsService.onApplicationBootstrap()
                               │  (registers a BullMQ scheduler on QUEUES.INTERVAL)
                               ▼
             QUEUES.INTERVAL.jobs.retry_infeasable_intents (repeat)
                               │
                               ▼
RetryInfeasableIntentsService.retryInfeasableIntents()
  ├─ Mongo find({ status: 'INFEASABLE',  expiration > minProofDate })
  └─ intentQueue.add( QUEUES.SOURCE_INTENT.jobs.retry_intent , intentHash )
                               │
                               ▼
   SolveIntentProcessor picks up the retry and re-runs validation steps
```

This mechanism prevents intents from getting stuck due to transient liquidity or proof-window issues without spamming the chain continuously.

---

## 4 Data & Infrastructure

- **Redis** – queues, cache (`@nestjs/cache-manager`).
- **MongoDB** – `IntentSource`, `Rebalance` records.
- **AWS KMS** – secure key storage.
- **Alchemy** – RPC & WS endpoints for supported chains.
- **Redlock** – distributed mutex via `nest-redlock`.

---

## 5 Notable Coding Conventions

- **BigInt to string** interceptor globally converts BigInt in API responses to strings (JSON safe).
- `Cacheable` custom decorator – annotation-style cache for service methods.
- Structured JSON logging via `EcoLogMessage` + Pino.

---
