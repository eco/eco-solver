import { Module } from '@nestjs/common';

import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';

import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [ConfigModule, FulfillmentModule],
  controllers: [QuotesController],
  providers: [QuotesService, ApiKeyGuard],
  exports: [QuotesService],
})
export class QuotesModule {}
