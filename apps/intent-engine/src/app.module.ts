import { Module } from '@nestjs/common'
import { IntentModule } from './domain/intent.module'
import { QuoteModule } from './domain/quote.module'
import { IntentInitiationModule } from './application/intent-initiation.module'
import { IntentProcessorModule } from './application/intent-processor.module'
import { IntentFulfillmentModule } from './application/intent-fulfillment.module'
import { ProverModule } from './infrastructure/prover.module'

@Module({
  imports: [
    IntentModule,
    QuoteModule,
    IntentInitiationModule,
    IntentProcessorModule,
    IntentFulfillmentModule,
    ProverModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
