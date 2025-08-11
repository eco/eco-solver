import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { IntentSourceModel, IntentSourceSchema } from './schemas/intent-source.schema'
import { CreateIntentService } from './create-intent.service'
import { ValidateIntentService } from './validate-intent.service'
import { FeasableIntentService } from './feasable-intent.service'
import { FulfillIntentService } from './fulfill-intent.service'
import { CrowdLiquidityService } from './crowd-liquidity.service'
import { UtilsIntentService } from './utils-intent.service'
import { ValidationService } from './validation.sevice'
import { WalletFulfillService } from './wallet-fulfill.service'
import { FeeModule, FlagsModule } from '@libs/domain'
import { QUEUES, initBullMQ } from '@libs/messaging'
import { IntentFulfillmentModule } from '../application/intent-fulfillment.module'

// These modules need to be imported from their proper locations
// TODO: Import these from the correct libraries once they are available
// import { BalanceModule } from '@libs/...' 
// import { ProverModule } from '@libs/...'  
// import { SolverModule } from '@libs/...'\n// import { TransactionModule } from '@libs/...'

@Module({
  imports: [
    // BalanceModule,
    FeeModule,
    FlagsModule,
    MongooseModule.forFeature([{ name: IntentSourceModel.name, schema: IntentSourceSchema }]),
    // ProverModule,
    // SolverModule,
    // TransactionModule,
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
