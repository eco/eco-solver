import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentProcessor } from '@/modules/fulfillment/fulfillment.processor';
import { FulfillmentService } from '@/modules/fulfillment/fulfillment.service';
import { IntentsModule } from '@/modules/intents/intents.module';
import { ProverModule } from '@/modules/prover/prover.module';
import { QueueModule } from '@/modules/queue/queue.module';

import { CrowdLiquidityFulfillmentStrategy } from './strategies/crowd-liquidity-fulfillment.strategy';
import { NativeIntentsFulfillmentStrategy } from './strategies/native-intents-fulfillment.strategy';
import { NegativeIntentsFulfillmentStrategy } from './strategies/negative-intents-fulfillment.strategy';
import { RhinestoneFulfillmentStrategy } from './strategies/rhinestone-fulfillment.strategy';
// Strategies
import { StandardFulfillmentStrategy } from './strategies/standard-fulfillment.strategy';
import { ChainSupportValidation } from './validations/chain-support.validation';
import { CrowdLiquidityFeeValidation } from './validations/crowd-liquidity-fee.validation';
import { ExecutorBalanceValidation } from './validations/executor-balance.validation';
import { ExpirationValidation } from './validations/expiration.validation';
// Validations
import { FundingValidation } from './validations/funding.validation';
import { NativeFeeValidation } from './validations/native-fee.validation';
import { ProverSupportValidation } from './validations/prover-support.validation';
import { RouteAmountLimitValidation } from './validations/route-amount-limit.validation';
import { RouteCallsValidation } from './validations/route-calls.validation';
import { RouteTokenValidation } from './validations/route-token.validation';
import { StandardFeeValidation } from './validations/standard-fee.validation';

@Module({
  imports: [
    ConfigModule,
    IntentsModule,
    QueueModule,
    ProverModule,
    BlockchainModule,
    BullModule.registerQueue({
      name: 'intent-fulfillment',
    }),
  ],
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
    FundingValidation,
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
  ],
  exports: [FulfillmentService],
})
export class FulfillmentModule {}
