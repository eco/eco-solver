import { FeeModule } from '@/fee/fee.module'
import { FulfillmentEstimateModule } from '@/fulfillment-estimate/fulfillment-estimate.module'
import { IntentModule } from '@/intent/intent.module'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { QuoteIntentModel, QuoteIntentSchema } from '@/quote/schemas/quote-intent.schema'
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteService } from './quote.service'

@Module({
  imports: [
    FeeModule,
    IntentModule,
    FulfillmentEstimateModule,
    MongooseModule.forFeature([{ name: QuoteIntentModel.name, schema: QuoteIntentSchema }]),
  ],
  providers: [QuoteService, QuoteRepository],
  exports: [QuoteService, QuoteRepository],
})
export class QuoteModule {}
