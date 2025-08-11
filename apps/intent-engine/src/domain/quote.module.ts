import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { QuoteIntentModel, QuoteIntentSchema } from './schemas/quote-intent.schema'
import { QuoteService } from './quote.service'
import { QuoteRepository } from './quote.repository'
import { FeeModule, FulfillmentEstimateModule } from '@libs/domain'
import { IntentModule } from './intent.module'

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
