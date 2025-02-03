import { Module } from '@nestjs/common'
import { QuoteService } from './quote.service'
import { MongooseModule } from '@nestjs/mongoose'
import { QuoteIntentModel, QuoteIntentSchema } from '@/quote/schemas/quote-intent.schema'
import { IntentModule } from '@/intent/intent.module'
import { BalanceModule } from '@/balance/balance.module'

@Module({
  imports: [
    BalanceModule,
    IntentModule,
    MongooseModule.forFeature([{ name: QuoteIntentModel.name, schema: QuoteIntentSchema }]),
  ],
  providers: [QuoteService],
  exports: [QuoteService],
})
export class QuoteModule {}
