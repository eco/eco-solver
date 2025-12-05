import { Global, Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { DataDogModule } from '@/modules/datadog/datadog.module';
import { FulfillmentProcessor } from '@/modules/fulfillment/fulfillment.processor';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { IntentFulfilledHandler } from '@/modules/fulfillment/handlers/intent-fulfilled.handler';
// Strategies
import {
  CrowdLiquidityFulfillmentStrategy,
  NativeIntentsFulfillmentStrategy,
  NegativeIntentsFulfillmentStrategy,
  RhinestoneFulfillmentStrategy,
  StandardFulfillmentStrategy,
} from '@/modules/fulfillment/strategies';
// Validations
import {
  ChainSupportValidation,
  CrowdLiquidityFeeValidation,
  DuplicateRewardTokensValidation,
  ExecutorBalanceValidation,
  ExpirationValidation,
  IntentFundedValidation,
  NativeFeeValidation,
  ProverSupportValidation,
  RhinestoneValidation,
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteEnabledValidation,
  RouteTokenValidation,
  StandardFeeValidation,
} from '@/modules/fulfillment/validations';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { ProverModule } from '@/modules/prover/prover.module';
import { QueueModule } from '@/modules/queue/queue.module';
import { RedisModule } from '@/modules/redis/redis.module';

import { IntentProcessingService } from './services/intent-processing.service';
// New specialized services
import { IntentSubmissionService } from './services/intent-submission.service';
import { StrategyManagementService } from './services/strategy-management.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    IntentsModule,
    ProverModule,
    QueueModule,
    RedisModule,
    OpenTelemetryModule,
    DataDogModule,
  ],
  providers: [
    // Core services
    IntentSubmissionService,
    IntentProcessingService,
    StrategyManagementService,
    // Main service (acts as facade)
    FulfillmentService,
    FulfillmentProcessor,
    // Event handlers
    IntentFulfilledHandler,
    // Strategies
    StandardFulfillmentStrategy,
    CrowdLiquidityFulfillmentStrategy,
    NativeIntentsFulfillmentStrategy,
    NegativeIntentsFulfillmentStrategy,
    RhinestoneFulfillmentStrategy,
    // Validations
    IntentFundedValidation,
    RouteTokenValidation,
    RouteCallsValidation,
    RouteAmountLimitValidation,
    RouteEnabledValidation,
    ExpirationValidation,
    ChainSupportValidation,
    ProverSupportValidation,
    ExecutorBalanceValidation,
    StandardFeeValidation,
    CrowdLiquidityFeeValidation,
    NativeFeeValidation,
    RhinestoneValidation,
    DuplicateRewardTokensValidation,
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
