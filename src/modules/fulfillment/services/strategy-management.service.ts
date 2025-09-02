import { Injectable, OnModuleInit } from '@nestjs/common';

import * as api from '@opentelemetry/api';

import { Intent } from '@/common/interfaces/intent.interface';
import {
  IFulfillmentStrategy,
  IStrategyRegistry,
  StrategyMetadata,
} from '@/common/interfaces/strategy-registry.interface';
import { FulfillmentConfigService } from '@/modules/config/services/fulfillment-config.service';
import { CrowdLiquidityFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { NativeIntentsFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { NegativeIntentsFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { RhinestoneFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { StandardFulfillmentStrategy } from '@/modules/fulfillment/strategies';
import { SystemLoggerService } from '@/modules/logging/logger.service';
import { OpenTelemetryService } from '@/modules/opentelemetry/opentelemetry.service';

/**
 * Service responsible for managing fulfillment strategies
 * Single Responsibility: Strategy lifecycle management and registration
 */
@Injectable()
export class StrategyManagementService implements IStrategyRegistry, OnModuleInit {
  private readonly strategies = new Map<string, IFulfillmentStrategy>();
  private readonly strategyMetadata = new Map<string, StrategyMetadata>();

  constructor(
    private readonly logger: SystemLoggerService,
    private readonly configService: FulfillmentConfigService,
    private readonly otelService: OpenTelemetryService,
    // Strategy dependencies injected here
    private readonly standardStrategy: StandardFulfillmentStrategy,
    private readonly crowdLiquidityStrategy: CrowdLiquidityFulfillmentStrategy,
    private readonly nativeIntentsStrategy: NativeIntentsFulfillmentStrategy,
    private readonly negativeIntentsStrategy: NegativeIntentsFulfillmentStrategy,
    private readonly rhinestoneStrategy: RhinestoneFulfillmentStrategy,
  ) {
    this.logger.setContext(StrategyManagementService.name);
  }

  async onModuleInit() {
    const span = this.otelService.startSpan('strategy.management.init');

    try {
      await this.initializeStrategies();
      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  private async initializeStrategies() {
    // Get strategy configuration from fulfillment config
    const fulfillmentConfig = this.configService.fulfillmentConfig;
    const strategies = fulfillmentConfig?.strategies;

    // Register each strategy with its metadata
    const strategyMap = {
      standard: this.standardStrategy,
      'crowd-liquidity': this.crowdLiquidityStrategy,
      'native-intents': this.nativeIntentsStrategy,
      'negative-intents': this.negativeIntentsStrategy,
      rhinestone: this.rhinestoneStrategy,
    } as const;

    for (const [name, strategy] of Object.entries(strategyMap)) {
      const enabled = strategies?.[name as keyof typeof strategies]?.enabled ?? false;
      const metadata: StrategyMetadata = {
        name,
        enabled,
        description: this.getStrategyDescription(name),
        priority: this.getStrategyPriority(name),
      };

      this.register(strategy, metadata);

      if (enabled) {
        this.logger.log(`Strategy '${name}' registered and enabled`);
      } else {
        this.logger.log(`Strategy '${name}' registered but disabled`);
      }
    }
  }

  register(strategy: IFulfillmentStrategy, metadata: StrategyMetadata): void {
    const span = this.otelService.startSpan('strategy.register', {
      attributes: {
        'strategy.name': metadata.name,
        'strategy.enabled': metadata.enabled,
        'strategy.priority': metadata.priority,
      },
    });

    try {
      this.strategies.set(metadata.name, strategy);
      this.strategyMetadata.set(metadata.name, metadata);
      span.setStatus({ code: api.SpanStatusCode.OK });
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  unregister(strategyName: string): void {
    this.strategies.delete(strategyName);
    this.strategyMetadata.delete(strategyName);
    this.logger.log(`Strategy '${strategyName}' unregistered`);
  }

  getStrategy(name: string): IFulfillmentStrategy | undefined {
    const metadata = this.strategyMetadata.get(name);
    if (!metadata?.enabled) {
      return undefined;
    }
    return this.strategies.get(name);
  }

  getStrategiesForIntent(intent: Intent): IFulfillmentStrategy[] {
    const span = this.otelService.startSpan('strategy.getForIntent', {
      attributes: {
        'intent.hash': intent.intentHash,
        'intent.source_chain': intent.sourceChainId?.toString() || 'unknown',
      },
    });

    try {
      const enabledStrategies = Array.from(this.strategies.entries())
        .filter(([name]) => this.isStrategyEnabled(name))
        .map(([, strategy]) => strategy)
        .filter((strategy) => strategy.canHandle(intent))
        .sort((a, b) => {
          const priorityA = this.strategyMetadata.get(a.name)?.priority ?? 0;
          const priorityB = this.strategyMetadata.get(b.name)?.priority ?? 0;
          return priorityB - priorityA;
        });

      span.setAttribute('strategy.matching_count', enabledStrategies.length);
      span.setStatus({ code: api.SpanStatusCode.OK });

      return enabledStrategies;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: api.SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  }

  getAllStrategies(): Map<string, IFulfillmentStrategy> {
    return new Map(this.strategies);
  }

  getDefaultStrategy(): IFulfillmentStrategy | undefined {
    const defaultName = this.configService.defaultStrategy;
    return defaultName && this.getStrategy(defaultName);
  }

  isStrategyEnabled(name: string): boolean {
    return this.strategyMetadata.get(name)?.enabled ?? false;
  }

  private getStrategyPriority(name: string): number {
    // Priority determines order when multiple strategies can handle an intent
    const priorities: Record<string, number> = {
      standard: 100,
      'native-intents': 90,
      'crowd-liquidity': 80,
      rhinestone: 70,
      'negative-intents': 60,
    };
    return priorities[name] ?? 0;
  }

  private getStrategyDescription(name: string): string {
    const descriptions: Record<string, string> = {
      standard: 'Default fulfillment strategy for standard intents',
      'crowd-liquidity': 'Uses crowd-sourced liquidity pools for fulfillment',
      'native-intents': 'Handles native token transfers',
      'negative-intents': 'Processes reverse/negative intents',
      rhinestone: 'Smart account integration for advanced fulfillment',
    };
    return descriptions[name] ?? 'Custom fulfillment strategy';
  }
}
