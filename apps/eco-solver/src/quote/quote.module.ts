import { Module } from '@nestjs/common'
import { QuoteService } from './quote.service'
import { MongooseModule } from '@nestjs/mongoose'
import { QuoteIntentModel, QuoteIntentSchema } from './schemas/quote-intent.schema'
import { IntentModule } from '../intent/intent.module'
import { FeeModule } from '../fee/fee.module'
import { QuoteRepository } from './quote.repository'
import { FulfillmentEstimateModule } from '../fulfillment-estimate/fulfillment-estimate.module'
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
