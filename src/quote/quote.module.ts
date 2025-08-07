import { Module } from '@nestjs/common'
import { QuoteService } from './quote.service'
import { MongooseModule } from '@nestjs/mongoose'
import { QuoteIntentModel, QuoteIntentSchema } from '@/quote/schemas/quote-intent.schema'
import { IntentModule } from '@/intent/intent.module'
import { FeeModule } from '@/fee/fee.module'
import { QuoteRepository } from '@/quote/quote.repository'
import { FulfillmentEstimateModule } from '@/fulfillment-estimate/fulfillment-estimate.module'
import { QuoteV2TransformService } from '@/quote/services/quote-v2-transform.service'
import { QuoteV2RequestTransformService } from '@/quote/services/quote-v2-request-transform.service'
import { ProverModule } from '@/prover/prover.module'

@Module({
  imports: [
    FeeModule,
    IntentModule,
    ProverModule,
    FulfillmentEstimateModule,
    MongooseModule.forFeature([{ name: QuoteIntentModel.name, schema: QuoteIntentSchema }]),
  ],
  providers: [
    QuoteService,
    QuoteRepository,
    QuoteV2TransformService,
    QuoteV2RequestTransformService,
  ],
  exports: [QuoteService, QuoteV2TransformService, QuoteV2RequestTransformService],
})
export class QuoteModule {}
