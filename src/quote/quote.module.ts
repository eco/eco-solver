import { Module } from '@nestjs/common'
import { QuoteService } from './quote.service'

@Module({
  imports: [],
  providers: [QuoteService],
  exports: [QuoteService],
})
export class QuoteModule {}
