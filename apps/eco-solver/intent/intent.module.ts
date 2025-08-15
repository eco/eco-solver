import { forwardRef, Module } from '@nestjs/common'
import { initBullMQ } from '../bullmq/bullmq.helper'
import { QUEUES } from '../common/redis/constants'
import { IntentSourceModel, IntentSourceSchema } from '@eco/infrastructure-database'
import { ValidateIntentService } from './validate-intent.service'
import { FeasableIntentService } from './feasable-intent.service'
import { CreateIntentService } from './create-intent.service'
import { UtilsIntentService } from './utils-intent.service'
import { BalanceModule } from '../balance/balance.module'
import { FulfillIntentService } from './fulfill-intent.service'
import { ProverModule } from '../prover/prover.module'
import { TransactionModule } from '../transaction/transaction.module'
import { MongooseModule } from '@nestjs/mongoose'
import { SolverModule } from '../solver/solver.module'
import { FlagsModule } from '../flags/flags.module'
import { ValidationService } from './validation.service'
import { FeeModule } from '@/fee/fee.module'
import { WalletFulfillService } from '@/intent/wallet-fulfill.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { IntentFulfillmentModule } from '@/intent-fulfillment/intent-fulfillment.module'

@Module({
  imports: [
    BalanceModule,
    FeeModule,
    FlagsModule,
    MongooseModule.forFeature([{ name: IntentSourceModel.name, schema: IntentSourceSchema }]),
    ProverModule,
    SolverModule,
    TransactionModule,
    initBullMQ(QUEUES.SOURCE_INTENT),
    forwardRef(() => IntentFulfillmentModule),
  ],
  providers: [
    CreateIntentService,
    ValidateIntentService,
    FeasableIntentService,
    FulfillIntentService,
    CrowdLiquidityService,
    UtilsIntentService,
    ValidationService,
    WalletFulfillService,
  ],
  // controllers: [IntentSourceController],
  exports: [
    CreateIntentService,
    ValidateIntentService,
    FeasableIntentService,
    FulfillIntentService,
    CrowdLiquidityService,
    UtilsIntentService,
    ValidationService,
    MongooseModule, //add IntentSourceModel to the rest of the modules that import intents
  ],
})
export class IntentModule {}
