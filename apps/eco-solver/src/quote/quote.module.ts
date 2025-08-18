import { Module } from '@nestjs/common'
import { QuoteService } from './quote.service'
import { MongooseModule } from '@nestjs/mongoose'
import { QuoteIntentModel, QuoteIntentSchema } from '@eco-solver/quote/schemas/quote-intent.schema'
import { IntentModule } from '@eco-solver/intent/intent.module'
import { FeeModule } from '@eco-solver/fee/fee.module'
import { QuoteRepository } from '@eco-solver/quote/quote.repository'
import { FulfillmentEstimateModule } from '@eco-solver/fulfillment-estimate/fulfillment-estimate.module'
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
