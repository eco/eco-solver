import { Module } from '@nestjs/common'
import { QuoteService } from './quote.service'
import { MongooseModule } from '@nestjs/mongoose'
import { QuoteIntentModel, QuoteIntentSchema } from '@eco/infrastructure-database'
import { IntentModule } from '@/intent/intent.module'
import { FeeModule } from '@/fee/fee.module'
import { QuoteRepository } from '@eco/infrastructure-database'
import { FulfillmentEstimateModule } from '@/fulfillment-estimate/fulfillment-estimate.module'
@Module({
  imports: [
    FeeModule,
    IntentModule,
    FulfillmentEstimateModule,
    MongooseModule.forFeature([{ name: QuoteIntentModel.name, schema: QuoteIntentSchema }]),
  ],
  providers: [QuoteService, QuoteRepository],
  exports: [QuoteService],
})
export class QuoteModule {}
