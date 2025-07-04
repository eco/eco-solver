import { Module } from '@nestjs/common'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { QUEUES } from '@/common/redis/constants'
import { IntentSourceModel, IntentSourceSchema } from '@/intent/schemas/intent-source.schema'
import { WithdrawalModel, WithdrawalSchema } from '@/intent/schemas/withdrawal.schema'
import { ValidateIntentService } from '@/intent/validate-intent.service'
import { FeasableIntentService } from '@/intent/feasable-intent.service'
import { CreateIntentService } from '@/intent/create-intent.service'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { FulfillIntentService } from '@/intent/fulfill-intent.service'
import { ProverModule } from '@/prover/prover.module'
import { TransactionModule } from '@/transaction/transaction.module'
import { MongooseModule } from '@nestjs/mongoose'
import { SolverModule } from '@/solver/solver.module'
import { FlagsModule } from '@/flags/flags.module'
import { ValidationService } from '@/intent/validation.sevice'
import { FeeModule } from '@/fee/fee.module'
import { WalletFulfillService } from '@/intent/wallet-fulfill.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { WithdrawalService } from '@/intent/withdrawal.service'
import { WithdrawalRepository } from '@/intent/repositories/withdrawal.repository'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { BalanceModule } from '@/balance/balance.module'
@Module({
  imports: [
    BalanceModule,
    FeeModule,
    FlagsModule,
    MongooseModule.forFeature([
      { name: IntentSourceModel.name, schema: IntentSourceSchema },
      { name: WithdrawalModel.name, schema: WithdrawalSchema },
    ]),
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
    ValidationService,
    WalletFulfillService,
    WithdrawalService,
    WithdrawalRepository,
    IntentSourceRepository,
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
    WithdrawalService,
    WithdrawalRepository,
    IntentSourceRepository,
    MongooseModule, //add IntentSourceModel to the rest of the modules that import intents
  ],
})
export class IntentModule {}
