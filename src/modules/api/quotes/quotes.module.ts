import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { QuotesController } from './controllers/quotes.controller';
import { QuoteRegistrationService } from './services/quote-registration.service';
import { QuotesService } from './services/quotes.service';

@Module({
  imports: [
    BlockchainModule,
    ConfigModule,
    FulfillmentModule,
    HttpModule,
    IntentsModule,
    LoggingModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteRegistrationService],
  exports: [QuotesService, QuoteRegistrationService],
})
export class QuotesModule {}
