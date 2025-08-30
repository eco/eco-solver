import { FeeModule } from '@/fee/fee.module'
import { FulfillmentEstimateModule } from '@/fulfillment-estimate/fulfillment-estimate.module'
import { IntentModule } from '@/intent/intent.module'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ProverModule } from '@/prover/prover.module'
import { QuoteIntentModel, QuoteIntentSchema } from '@/quote/schemas/quote-intent.schema'
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteService } from './quote.service'
import { QuoteV2RequestTransformService } from '@/quote/services/quote-v2-request-transform.service'
import { QuoteV2TransformService } from '@/quote/services/quote-v2-transform.service'

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
