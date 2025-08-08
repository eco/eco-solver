import { BalanceModule } from '../balance/balance.module'
import { CreateIntentService } from './create-intent.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { FeasableIntentService } from './feasable-intent.service'
import { FeeModule } from '@/fee/fee.module'
import { FlagsModule } from '../flags/flags.module'
import { forwardRef, Module } from '@nestjs/common'
import { FulfillIntentService } from './fulfill-intent.service'
import { initBullMQ } from '../bullmq/bullmq.helper'
import { IntentFulfillmentModule } from '@/intent-fulfillment/intent-fulfillment.module'
import { IntentSourceModel, IntentSourceSchema } from './schemas/intent-source.schema'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { MongooseModule } from '@nestjs/mongoose'
import { ProverModule } from '../prover/prover.module'
import { QUEUES } from '../common/redis/constants'
import { SolverModule } from '../solver/solver.module'
import { TransactionModule } from '../transaction/transaction.module'
import { UtilsIntentService } from './utils-intent.service'
import { ValidateIntentService } from './validate-intent.service'
import { ValidationService } from '@/intent/validation.sevice'
import { WalletFulfillService } from '@/intent/wallet-fulfill.service'

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
    CrowdLiquidityService,
    FeasableIntentService,
    FulfillIntentService,
    IntentSourceRepository,
    UtilsIntentService,
    ValidateIntentService,
    ValidationService,
    WalletFulfillService,
  ],
  // controllers: [IntentSourceController],
  exports: [
    CreateIntentService,
    CrowdLiquidityService,
    FeasableIntentService,
    FulfillIntentService,
    IntentSourceRepository,
    UtilsIntentService,
    ValidateIntentService,
    ValidationService,
    MongooseModule, //add IntentSourceModel to the rest of the modules that import intents
  ],
})
export class IntentModule {}
