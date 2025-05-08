import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { Module } from '@nestjs/common'
import { TransactionModule } from '@/transaction/transaction.module'
import { QuoteModule } from '@/quote/quote.module'
import { IntentModule } from '@/intent/intent.module'

@Module({
  imports: [TransactionModule, QuoteModule, IntentModule],

  controllers: [],

  providers: [IntentInitiationService],

  exports: [IntentInitiationService],
})
export class IntentInitiationModule {}
