import {
  GroupedIntent,
  GroupedIntentSchema,
} from '@/intent-initiation/schemas/grouped-intent.schema'
import { GroupedIntentRepository } from '@/intent-initiation/repositories/grouped-intent.repository'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { IntentModule } from '@/intent/intent.module'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PermitValidationModule } from '@/intent-initiation/permit-validation/permit-validation.module'
import { QuoteModule } from '@/quote/quote.module'
import { TransactionModule } from '@/transaction/transaction.module'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GroupedIntent.name, schema: GroupedIntentSchema }]),
    PermitValidationModule,
    TransactionModule,
    QuoteModule,
    IntentModule,
  ],

  controllers: [],

  providers: [IntentInitiationService, GroupedIntentRepository],

  exports: [
    IntentInitiationService,
    GroupedIntentRepository,
    PermitValidationModule,
    TransactionModule,
    QuoteModule,
    IntentModule,
  ],
})
export class IntentInitiationModule {}
