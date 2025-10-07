import { CacheModule } from '@nestjs/cache-manager'
import { FeeModule } from '@/fee/fee.module'
import { ForwardQuoteRequestTransformer } from '@/quote/services/forward-quote-request-transformer'
import { FulfillmentEstimateModule } from '@/fulfillment-estimate/fulfillment-estimate.module'
import { IntentModule } from '@/intent/intent.module'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ProverModule } from '@/prover/prover.module'
import { QuoteIntentModel, QuoteIntentSchema } from '@/quote/schemas/quote-intent.schema'
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteService } from './quote.service'
import { QuoteV2RequestTransformService } from '@/quote/services/quote-v2-request-transform.service'
import { QuoteV2Service } from '@/quote/quote-v2.service'
import { QuoteV2TransformService } from '@/quote/services/quote-v2-transform.service'
import { ReverseQuoteRequestTransformer } from '@/quote/services/reverse-quote-request-transformer'

@Module({
  imports: [
    CacheModule.register(),
    FeeModule,
    IntentModule,
    ProverModule,
    FulfillmentEstimateModule,
    MongooseModule.forFeature([{ name: QuoteIntentModel.name, schema: QuoteIntentSchema }]),
  ],
  providers: [
    QuoteService,
    QuoteV2Service,
    QuoteRepository,
    QuoteV2TransformService,
    QuoteV2RequestTransformService,
    ForwardQuoteRequestTransformer,
    ReverseQuoteRequestTransformer,
  ],
  exports: [
    QuoteService,
    QuoteV2Service,
    QuoteRepository,
    QuoteV2TransformService,
    QuoteV2RequestTransformService,
    ForwardQuoteRequestTransformer,
    ReverseQuoteRequestTransformer,
  ],
})
export class QuoteModule {}
