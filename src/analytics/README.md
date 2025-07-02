# Analytics Module

A comprehensive analytics module for PostHog integration, designed specifically for backend services.

## Features

- **Event Tracking**: Capture custom events with properties
- **Feature Flags**: Check feature flag status and get flag values
- **Group Analytics**: Track team/service-level analytics with automatic environment segmentation
- **Environment-Based Grouping**: Automatic environment identification (dev, staging, production) for proper analytics segmentation
- **Backend Optimized**: Focused on backend analytics needs (no user identification/person properties)
- **Flexible Configuration**: Multiple ways to configure the module
- **Error Handling**: Comprehensive error handling with logging

## Installation

The PostHog Node.js SDK is already installed. To use the analytics module:

```typescript
import { AnalyticsModule, AnalyticsService, ANALYTICS_SERVICE } from '@/analytics'
```

## Configuration

### Basic Configuration

```typescript
import { AnalyticsModule } from '@/analytics'

@Module({
  imports: [
    AnalyticsModule.withPostHog({
      apiKey: 'your-posthog-api-key',
      host: 'https://us.posthog.com', // optional, defaults to US endpoint
      flushAt: 20, // optional, batch size
      flushInterval: 10000, // optional, flush interval in ms
    }),
  ],
})
export class AppModule {}
```

### Async Configuration with Environment Groups

```typescript
import { AnalyticsModule } from '@/analytics'
import { getCurrentEnvironment } from '@/analytics/utils'
import { EcoConfigService } from '@/eco-configs'

@Module({
  imports: [
    AnalyticsModule.withAsyncConfig({
      useFactory: async (configService: EcoConfigService) => {
        const analyticsConfig = configService.getAnalyticsConfig()

        // Get the current environment for group identification
        const environment = getCurrentEnvironment()

        return {
          ...analyticsConfig,
          // Set environment-based group context for analytics
          groups: {
            environment: environment,
          },
        }
      },
      inject: [EcoConfigService],
    }),
  ],
})
export class AppModule {}
```

### Factory Configuration

```typescript
import { AnalyticsModule } from '@/analytics'

@Module({
  imports: [
    AnalyticsModule.withConfig(() => ({
      apiKey: process.env.POSTHOG_API_KEY,
      host: process.env.POSTHOG_HOST || 'https://us.posthog.com',
    })),
  ],
})
export class AppModule {}
```

## Usage

### Basic Event Tracking

```typescript
import { Injectable, Inject } from '@nestjs/common'
import { AnalyticsService, ANALYTICS_SERVICE } from '@/analytics'

@Injectable()
export class SomeService {
  constructor(@Inject(ANALYTICS_SERVICE) private readonly analytics: AnalyticsService) {}

  async processIntent(intentId: string, userId: string) {
    // Track an event with properties
    await this.analytics.trackEvent('intent_processed', {
      intentId,
      userId,
      timestamp: new Date().toISOString(),
      service: 'intent-processor',
    })

    // Or use capture with explicit distinctId
    await this.analytics.capture(userId, 'intent_processed', {
      intentId,
      processingTime: 150,
    })
  }
}
```

### Feature Flags with Environment Context

```typescript
@Injectable()
export class FeatureService {
  constructor(@Inject(ANALYTICS_SERVICE) private readonly analytics: AnalyticsService) {}

  async shouldUseNewAlgorithm(userId: string): Promise<boolean> {
    // Environment groups are automatically included from configuration
    return await this.analytics.isFeatureEnabled('new-algorithm', userId)
  }

  async getFeatureFlagValue(userId: string): Promise<string | boolean | undefined> {
    // You can also provide additional groups that merge with environment groups
    return await this.analytics.getFeatureFlag('algorithm-version', userId, {
      service: 'intent-processor',
      region: 'us-west-2',
    })
  }

  async getAllUserFlags(userId: string): Promise<Record<string, string | boolean>> {
    return await this.analytics.getAllFlags(userId)
  }
}
```

### Group Analytics

```typescript
@Injectable()
export class TeamAnalyticsService {
  constructor(private readonly analytics: AnalyticsService) {}

  async trackTeamMetrics(teamId: string, metrics: Record<string, any>) {
    // Identify the team/group
    await this.analytics.groupIdentify('team', teamId, {
      teamSize: metrics.teamSize,
      region: metrics.region,
      tier: metrics.tier,
    })

    // Track team-level events
    await this.analytics.capture(`team:${teamId}`, 'team_metrics_updated', metrics)
  }
}
```

### Batch Operations

```typescript
@Injectable()
export class AnalyticsManagerService {
  constructor(private readonly analytics: AnalyticsService) {}

  async onApplicationShutdown() {
    // Flush any pending events before shutdown
    await this.analytics.flush()
    await this.analytics.shutdown()
  }

  async processLargeDataset(data: any[]) {
    // Process data and track events...

    // Manually flush after processing large datasets
    await this.analytics.flush()
  }
}
```

## Configuration Options

| Option                        | Type     | Default                  | Description                              |
| ----------------------------- | -------- | ------------------------ | ---------------------------------------- |
| `apiKey`                      | string   | **required**             | PostHog API key                          |
| `host`                        | string   | `https://us.posthog.com` | PostHog endpoint URL                     |
| `flushAt`                     | number   | `20`                     | Batch size before sending events         |
| `flushInterval`               | number   | `10000`                  | Flush interval in milliseconds           |
| `requestTimeout`              | number   | `10000`                  | Request timeout in milliseconds          |
| `maxCacheSize`                | number   | `10000`                  | Maximum number of events to cache        |
| `disableGeoip`                | boolean  | `false`                  | Disable GeoIP location tracking          |
| `personalApiKey`              | string   | undefined                | Personal API key for feature flags       |
| `featureFlagsPollingInterval` | number   | `30000`                  | Feature flags polling interval in ms     |
| `onError`                     | function | logger.error             | Error handling function                  |
| `groups`                      | object   | `{}`                     | Default group context for all operations |

## Environment-Based Analytics Segmentation

The analytics module automatically supports environment-based group identification, allowing you to segment analytics data across different deployment environments (development, staging, preproduction, production).

### How It Works

1. **Automatic Environment Detection**: The module reads `NODE_ENV` to determine the current environment
2. **Group Identification**: During initialization, the service automatically identifies the environment as a group in PostHog
3. **Context Propagation**: All feature flag evaluations include the environment context automatically
4. **Merge Strategy**: Default environment groups merge with any additional groups you provide

### Environment Configuration

```typescript
import { getCurrentEnvironment } from '@/analytics/utils'

// Environments are automatically detected from NODE_ENV:
// - development (default if NODE_ENV is not set)
// - staging
// - preproduction
// - production
// - test

const environment = getCurrentEnvironment()
// Returns: 'development' | 'staging' | 'preproduction' | 'production' | 'test'

// The analytics service will automatically create groups like:
// { environment: 'production' }
// { environment: 'development' }
```

### Benefits

- **Deployment Segmentation**: Separate analytics for dev, staging, and production
- **Feature Flag Targeting**: Target features to specific environments
- **Performance Monitoring**: Monitor performance differences across environments
- **Safe Testing**: Test analytics changes in dev/staging before production

### Example Feature Flag Targeting

In PostHog, you can now target features based on environment:

```typescript
// This will respect the environment context automatically
const isEnabled = await this.analytics.isFeatureEnabled('new-feature', 'user123')

// You can also add additional targeting context
const isEnabled = await this.analytics.isFeatureEnabled('new-feature', 'user123', {
  service: 'intent-processor', // Additional context beyond environment
  region: 'us-west-2',
})
```

## Best Practices

1. **Use meaningful event names**: Use descriptive names like `intent_processed`, `payment_completed`
2. **Include context**: Add relevant properties like `userId`, `intentId`, `timestamp`
3. **Environment segmentation**: Configure environment groups for proper analytics segmentation across deployments
4. **Backend-focused**: This module is optimized for backend services, not user-facing analytics
5. **Error handling**: All methods include proper error handling and logging
6. **Batch operations**: Use `flush()` after processing large datasets
7. **Shutdown handling**: Call `shutdown()` in your application shutdown lifecycle
8. **Group hierarchy**: Use environment groups for deployment segmentation, and additional groups for service/feature targeting

## Example Integration

```typescript
// app.module.ts
import { getCurrentEnvironment } from '@/analytics/utils'

@Module({
  imports: [
    AnalyticsModule.withAsyncConfig({
      useFactory: async (configService: EcoConfigService) => {
        const analyticsConfig = configService.getAnalyticsConfig()

        // Get the current environment for group identification
        const environment = getCurrentEnvironment()

        return {
          ...analyticsConfig,
          // Set environment-based group context for analytics
          groups: {
            environment: environment,
            service: 'eco-solver',
          },
        }
      },
      inject: [EcoConfigService],
    }),
    // ... other modules
  ],
})
export class AppModule {}

// intent.service.ts
@Injectable()
export class IntentService {
  constructor(private readonly analytics: AnalyticsService) {}

  async createIntent(intentData: any, userId: string) {
    // Business logic...

    // Track the event
    await this.analytics.trackEvent('intent_created', {
      intentId: intentData.id,
      userId,
      sourceChain: intentData.sourceChain,
      destinationChain: intentData.destinationChain,
      amount: intentData.amount,
      timestamp: new Date().toISOString(),
    })
  }
}
```

## Error Handling

The analytics module includes comprehensive error handling with structured error classes and centralized logging.

### Error Classes

The module provides three main classes for error handling:

- **`AnalyticsError`**: Custom error class with error codes and context information
- **`AnalyticsMessages`**: Static success message class for consistent messaging
- **`AnalyticsLogger`**: Static logger interface for structured logging

### Using AnalyticsError

```typescript
import { AnalyticsError } from '@/analytics'

// The service automatically uses these error classes internally
// You can also use them in your own analytics-related code

try {
  await analyticsService.trackEvent('user_action', { userId: '123' })
} catch (error) {
  if (error instanceof AnalyticsError) {
    console.log('Analytics error code:', error.code)
    console.log('Error context:', error.context)
  }
}
```

### Available Error Types

| Error Method               | Code                        | Description                          |
| -------------------------- | --------------------------- | ------------------------------------ |
| `missingApiKey()`          | `MISSING_API_KEY`           | PostHog API key is not configured    |
| `eventCaptureFailed()`     | `EVENT_CAPTURE_FAILED`      | Failed to capture analytics event    |
| `featureFlagCheckFailed()` | `FEATURE_FLAG_CHECK_FAILED` | Failed to check feature flag status  |
| `featureFlagGetFailed()`   | `FEATURE_FLAG_GET_FAILED`   | Failed to get feature flag value     |
| `allFlagsGetFailed()`      | `ALL_FLAGS_GET_FAILED`      | Failed to retrieve all feature flags |
| `groupIdentifyFailed()`    | `GROUP_IDENTIFY_FAILED`     | Failed to identify analytics group   |
| `flushFailed()`            | `FLUSH_FAILED`              | Failed to flush pending events       |
| `shutdownFailed()`         | `SHUTDOWN_FAILED`           | Failed to shutdown analytics service |
| `posthogError()`           | `POSTHOG_ERROR`             | General PostHog client error         |

### Error Recovery

The analytics service implements graceful error handling:

- **Feature Flags**: Return `false` or `undefined` on errors to prevent service disruption
- **Event Tracking**: Logs errors but doesn't break application flow
- **Group Operations**: Log warnings for non-critical group identification failures
- **Batch Operations**: Retry logic and graceful degradation for flush/shutdown operations

### Custom Logging

You can use the `AnalyticsLogger` for consistent error logging in your own code:

```typescript
import { AnalyticsLogger, AnalyticsError } from '@/analytics'
import { Logger } from '@nestjs/common'

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name)

  handleAnalyticsError(error: unknown) {
    if (error instanceof AnalyticsError) {
      AnalyticsLogger.logError(this.logger, error)
    } else {
      // Convert to analytics error for consistent logging
      const analyticsError = AnalyticsError.posthogError(error)
      AnalyticsLogger.logError(this.logger, analyticsError)
    }
  }
}
```
