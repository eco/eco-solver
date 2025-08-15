# Analytics Module

Comprehensive analytics tracking for the eco-solver application. This module provides centralized event tracking, error monitoring, and performance metrics across all application components.

## Overview

The analytics system follows a **centralized, object-based tracking approach** that keeps business logic clean while providing comprehensive visibility into application behavior. All analytics operations are fire-and-forget to ensure they never block business operations.

## Architecture

### Core Components

- **`EcoAnalyticsService`** - Primary service handling all analytics operations
- **`AnalyticsService`** - Configurable analytics interface (PostHog implementation)
- **`events.constants.ts`** - Centralized event name constants
- **`AnalyticsModule`** - Global NestJS module configuration

### Key Principles

1. **Pass Complete Objects** - Always pass full objects to analytics methods rather than extracting data
2. **Centralized Data Extraction** - Let the analytics service handle all data extraction internally
3. **Fire-and-Forget** - Analytics calls never throw errors or block business logic
4. **Comprehensive Instrumentation** - Every component tracks operations, errors, and performance
5. **Event Constants** - All event names use constants from `events.constants.ts`

## Module-by-Module Analytics Coverage

### 📊 **API Module** (`src/api/`)

**Analytics Focus:** Request/response tracking with timing metrics

| Service             | Tracked Operations                              | Key Events                                                                 |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| **QuoteController** | Quote requests, reverse quotes, response timing | `QUOTE_REQUEST_RECEIVED`, `QUOTE_RESPONSE_SUCCESS`, `QUOTE_RESPONSE_ERROR` |

**Sample Usage:**

```typescript
// Track incoming quote request
this.ecoAnalytics.trackQuoteRequestReceived(quoteIntentDataDTO)

// Track successful response with timing
this.ecoAnalytics.trackQuoteResponseSuccess(quoteIntentDataDTO, processingTime, quote)
```

---

### 🎯 **Intent Module** (`src/intent/`)

**Analytics Focus:** Complete intent lifecycle from creation to fulfillment

| Service                   | Tracked Operations                                              | Key Events                                                                                  |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **CreateIntentService**   | Intent creation, gasless intents, duplicates, wallet validation | `INTENT_CREATION_STARTED`, `INTENT_CREATED_AND_QUEUED`, `GASLESS_INTENT_CREATED`            |
| **ValidateIntentService** | Intent validation, funding checks, retry logic                  | `INTENT_VALIDATION_STARTED`, `INTENT_VALIDATED_AND_QUEUED`, `FUNDING_VERIFIED`              |
| **FeasibleIntentService** | Feasibility analysis, infeasible intent handling                | `FEASIBILITY_CHECK_STARTED`, `INTENT_FEASIBLE_AND_QUEUED`, `INTENT_INFEASIBLE`              |
| **FulfillIntentService**  | Fulfillment methods, crowd liquidity, wallet fallbacks          | `FULFILLMENT_STARTED`, `FULFILLMENT_METHOD_SELECTED`, `CROWD_LIQUIDITY_FULFILLMENT_STARTED` |

**Sample Usage:**

```typescript
// Track intent creation with complete objects
this.ecoAnalytics.trackIntentCreationStarted(intent, intentWs)

// Track fulfillment method selection
this.ecoAnalytics.trackIntentFulfillmentMethodSelected(
  intentHash,
  fulfillmentType,
  isNativeIntent,
  model,
  solver,
)
```

**Intent Lifecycle Tracking:**

```
Creation → Validation → Feasibility → Fulfillment
    ↓         ↓           ↓            ↓
Analytics  Analytics   Analytics   Analytics
```

---

### 💰 **Quote Module** (`src/quote/`)

**Analytics Focus:** Quote processing pipeline and database operations

| Service             | Tracked Operations                                | Key Events                                                                      |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| **QuoteService**    | Quote processing, validation, generation, storage | `QUOTE_PROCESSING_STARTED`, `QUOTE_STORAGE_SUCCESS`, `QUOTE_GENERATION_SUCCESS` |
| **QuoteRepository** | Database operations, storage errors               | `QUOTE_DATABASE_STORE_ERROR`                                                    |

**Sample Usage:**

```typescript
// Track quote processing with reverse quote flag
this.ecoAnalytics.trackQuoteProcessingStarted(quoteIntentDataDTO, isReverseQuote)

// Track storage with complete objects
this.ecoAnalytics.trackQuoteStorageSuccess(quoteIntentDataDTO, quoteIntents)
```

---

### 👁️ **Watch Module** (`src/watch/`)

**Analytics Focus:** Blockchain event monitoring and job queue management

| Service                      | Tracked Operations                                 | Key Events                                                                                        |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **WatchCreateIntentService** | Intent creation events, subscriptions, job queuing | `CREATE_INTENT_SUBSCRIPTION_STARTED`, `CREATE_INTENT_EVENTS_DETECTED`, `CREATE_INTENT_JOB_QUEUED` |
| **WatchFulfillmentService**  | Fulfillment events, job processing                 | `FULFILLMENT_EVENTS_DETECTED`, `FULFILLMENT_JOB_QUEUED`                                           |
| **WatchIntentFundedService** | Funding events, database operations                | `INTENT_FUNDED_EVENTS_DETECTED`, `INTENT_FUNDED_JOB_QUEUED`                                       |
| **WatchEventService**        | Event subscription errors, recovery                | `UNSUBSCRIBE_ERROR`, `WATCH_ERROR_RECOVERY_STARTED`                                               |

**Sample Usage:**

```typescript
// Track event detection with batch count
this.ecoAnalytics.trackWatchCreateIntentEventsDetected(eventCount, source)

// Track job queue operations
this.ecoAnalytics.trackWatchCreateIntentJobQueued(createIntent, jobId, source)
```

---

### 🏥 **Health Module** (`src/health/`)

**Analytics Focus:** Application health monitoring

| Service              | Tracked Operations                             | Key Events                                                           |
| -------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| **HealthController** | Health check requests, response timing, errors | `HEALTH_CHECK_REQUEST`, `HEALTH_CHECK_SUCCESS`, `HEALTH_CHECK_ERROR` |

**Sample Usage:**

```typescript
// Track health check with timing
this.ecoAnalytics.trackRequestReceived(ANALYTICS_EVENTS.HEALTH.CHECK_REQUEST, {})
this.ecoAnalytics.trackResponseSuccess(ANALYTICS_EVENTS.HEALTH.CHECK_SUCCESS, {
  result,
  processingTimeMs: Date.now() - startTime,
})
```

---

### ⚙️ **BullMQ Processor Module** (`src/bullmq/`)

**Analytics Focus:** Background job processing performance

| Service                  | Tracked Operations                      | Key Events                                   |
| ------------------------ | --------------------------------------- | -------------------------------------------- |
| **SolveIntentProcessor** | Job lifecycle, timing, failure analysis | `JOB_STARTED`, `JOB_COMPLETED`, `JOB_FAILED` |

**Sample Usage:**

```typescript
// Track job processing with complete context
this.ecoAnalytics.trackSuccess('job_started', {
  jobName: 'solve-intent',
  jobId: job.id,
  jobData: job.data,
  attemptNumber: job.attemptsMade,
})
```

---

### 💧 **Liquidity Manager Module** (`src/liquidity-manager/`)

**Analytics Focus:** Cross-chain liquidity operations and provider performance

| Service                      | Tracked Operations                         | Key Events                                             |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| **LiquidityManagerService**  | Route finding, fallback strategies         | `QUOTE_ROUTE_ERROR`, `FALLBACK_ROUTE_ERROR`            |
| **LiquidityProviderService** | Strategy execution, provider errors        | `STRATEGY_QUOTE_ERROR`                                 |
| **LiFiProviderService**      | LiFi-specific operations, cache management | `LIFI_CACHE_INIT_ERROR`, `LIFI_CORE_TOKEN_ROUTE_ERROR` |
| **CCTPLiFiProviderService**  | CCTP-LiFi bridge operations                | `CCTP_LIFI_EXECUTION_ERROR`, `CCTP_LIFI_BRIDGE_ERROR`  |

**Sample Usage:**

```typescript
// Track liquidity provider errors with context
this.ecoAnalytics.trackError(ANALYTICS_EVENTS.LIQUIDITY_MANAGER.STRATEGY_QUOTE_ERROR, error, {
  walletAddress,
  strategy,
  tokenIn: this.formatToken(tokenIn),
  tokenOut: this.formatToken(tokenOut),
  swapAmount,
  operation: 'strategy_quote',
  service: this.constructor.name,
})
```

## Event Constants Reference

All analytics events are centrally defined in `events.constants.ts`:

### Event Categories

| Category                     | Events Count | Purpose                     |
| ---------------------------- | ------------ | --------------------------- |
| **INTENT_EVENTS**            | 25+          | Intent lifecycle tracking   |
| **QUOTE_EVENTS**             | 12+          | Quote processing pipeline   |
| **WATCH_EVENTS**             | 11+          | Blockchain event monitoring |
| **HEALTH_EVENTS**            | 3            | Application health          |
| **JOB_EVENTS**               | 3            | Background job processing   |
| **LIQUIDITY_MANAGER_EVENTS** | 8+           | Cross-chain liquidity       |
| **BALANCE_EVENTS**           | 5            | Balance tracking            |
| **ERROR_EVENTS**             | 10+          | Error categorization        |

### Usage Pattern

```typescript
import { ANALYTICS_EVENTS } from './events.constants'

// Module-namespaced event access
this.ecoAnalytics.trackError(ANALYTICS_EVENTS.INTENT.CREATION_FAILED, error, context)
this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.QUOTE.PROCESSING_SUCCESS, data)
```

## Implementation Guidelines

### ✅ Best Practices

```typescript
// Pass complete objects
this.ecoAnalytics.trackIntentCreationStarted(intent, intentWs)

// Use event constants
this.ecoAnalytics.trackError(ANALYTICS_EVENTS.INTENT.CREATION_FAILED, error, context)

// Include operation timing
const startTime = Date.now()
// ... business logic ...
this.ecoAnalytics.trackSuccess(eventName, {
  ...context,
  processingTimeMs: Date.now() - startTime,
})
```

### ❌ Anti-Patterns

```typescript
// Don't extract data inline
this.ecoAnalytics.track(eventName, {
  intentHash: model.intent.hash,  // ❌ Don't do this
  sourceChain: model.intent.route.source,  // ❌ Don't do this
})

// Don't use hardcoded strings
this.ecoAnalytics.trackError('intent_failed', error, context)  // ❌ Don't do this

// Don't block on analytics
await this.ecoAnalytics.track(...)  // ❌ Don't do this
```

## Configuration

### Global Module Setup

The `AnalyticsModule` is configured globally in `app.module.ts`:

```typescript
@Global()
@Module({
  imports: [
    AnalyticsModule.forRoot({
      apiKey: configService.get('POSTHOG_API_KEY'),
      options: {
        host: 'https://us.i.posthog.com',
        flushAt: 20,
        flushInterval: 10000,
      },
    }),
  ],
  // ...
})
export class AnalyticsModule {}
```

### Service Integration

```typescript
@Injectable()
export class YourService {
  constructor(private readonly ecoAnalytics: EcoAnalyticsService) {}

  async yourMethod() {
    const startTime = Date.now()

    try {
      // Business logic
      const result = await this.doSomething()

      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.YOUR_MODULE.OPERATION_SUCCESS, {
        result,
        processingTimeMs: Date.now() - startTime,
      })

      return result
    } catch (error) {
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.YOUR_MODULE.OPERATION_FAILED, error, {
        processingTimeMs: Date.now() - startTime,
      })
      throw error
    }
  }
}
```

## Analytics Coverage Summary

### 📊 **Coverage Statistics**

- **Total Services Instrumented:** 15+
- **Total Analytics Methods:** 75+
- **Total Analytics Calls:** 80+
- **Event Categories:** 8
- **Event Constants Defined:** 70+

### 🎯 **Coverage Assessment**

| Component Type     | Coverage | Status             |
| ------------------ | -------- | ------------------ |
| **Controllers**    | 100%     | ✅ Complete        |
| **Services**       | 95%      | ✅ Nearly Complete |
| **Repositories**   | 90%      | ✅ Well Covered    |
| **Processors**     | 100%     | ✅ Complete        |
| **Watch Services** | 100%     | ✅ Complete        |
| **Error Handling** | 95%      | ✅ Comprehensive   |

### 🔧 **Maintenance**

For systematic analytics auditing and compliance checking, see:

- **[Analytics Linter Rules](../.claude/rules/analytics-linter.md)** - Complete compliance rules and detection commands
- Use Rule 1-8 from the linter to ensure comprehensive coverage
- Run automated detection commands to find gaps

---

_This README.md is automatically generated and should be updated whenever new analytics tracking is added. See the analytics linter rules for systematic updates._
