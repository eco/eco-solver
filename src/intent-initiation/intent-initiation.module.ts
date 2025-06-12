import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { Module } from '@nestjs/common'
import { PermitValidationModule } from '@/intent-initiation/permit-validation/permit-validation.module'
import { IntentModule } from '@/intent/intent.module'
import { QuoteModule } from '@/quote/quote.module'
import { TransactionModule } from '@/transaction/transaction.module'

@Module({
  imports: [PermitValidationModule, TransactionModule, QuoteModule, IntentModule],

  controllers: [],

  providers: [IntentInitiationService],

  exports: [IntentInitiationService, PermitValidationModule],
})
export class IntentInitiationModule {}
