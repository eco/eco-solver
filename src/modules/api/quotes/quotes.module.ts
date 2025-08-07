import { Module, forwardRef } from '@nestjs/common';

import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';

import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [forwardRef(() => FulfillmentModule)],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}