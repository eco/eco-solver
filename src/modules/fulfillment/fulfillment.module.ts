import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentProcessor } from '@/modules/fulfillment/fulfillment.processor';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
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
  RouteAmountLimitValidation,
  RouteCallsValidation,
  RouteTokenValidation,
  StandardFeeValidation,
} from '@/modules/fulfillment/validations';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { ProverModule } from '@/modules/prover/prover.module';
import { TokenModule } from '@/modules/token/token.module';

@Module({
  imports: [ConfigModule, LoggingModule, IntentsModule, ProverModule, TokenModule],
  providers: [
    // Core services
    FulfillmentService,
    FulfillmentProcessor,
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
    ExpirationValidation,
    ChainSupportValidation,
    ProverSupportValidation,
    ExecutorBalanceValidation,
    StandardFeeValidation,
    CrowdLiquidityFeeValidation,
    NativeFeeValidation,
    DuplicateRewardTokensValidation,
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
