import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { IntentModule } from '@/intent/intent.module'
import { Module } from '@nestjs/common'
import { PermitDataModule } from '@/intent-initiation/permit-data/permit-data.module'
import { PermitValidationModule } from '@/intent-initiation/permit-validation/permit-validation.module'
import { QuoteModule } from '@/quote/quote.module'
import { TransactionModule } from '@/transaction/transaction.module'

@Module({
  imports: [PermitDataModule, PermitValidationModule, TransactionModule, QuoteModule, IntentModule],

  controllers: [],

  providers: [IntentInitiationService],

  exports: [
    IntentInitiationService,
    PermitDataModule,
    PermitValidationModule,
    TransactionModule,
    QuoteModule,
    IntentModule,
  ],
})
export class IntentInitiationModule {}
