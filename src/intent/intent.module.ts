import { Module } from '@nestjs/common'
import { initBullMQ } from '../bullmq/bullmq.helper'
import { QUEUES } from '../common/redis/constants'
import { IntentSourceModel, IntentSourceSchema } from './schemas/intent-source.schema'
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
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'

@Module({
  imports: [
    BalanceModule,
    FlagsModule,
    MongooseModule.forFeature([{ name: IntentSourceModel.name, schema: IntentSourceSchema }]),
    ProverModule,
    SolverModule,
    TransactionModule,
    initBullMQ(QUEUES.SOURCE_INTENT),
  ],
  providers: [
    CreateIntentService,
    ValidateIntentService,
    FeasableIntentService,
    FulfillIntentService,
    CrowdLiquidityService,
    UtilsIntentService,
  ],
  // controllers: [IntentSourceController],
  exports: [
    CreateIntentService,
    ValidateIntentService,
    FeasableIntentService,
    FulfillIntentService,
    CrowdLiquidityService,
    UtilsIntentService,
    MongooseModule, //add IntentSourceModel to the rest of the modules that import intents
  ],
})
export class IntentModule {}
