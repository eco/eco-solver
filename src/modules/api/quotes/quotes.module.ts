import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { ProverModule } from '@/modules/prover/prover.module';

import { QuotesController } from './controllers/quotes.controller';
import { QuotesEnabledGuard } from './guards/quotes-enabled.guard';
import { QuoteRegistrationService } from './services/quote-registration.service';
import { QuotesService } from './services/quotes.service';

@Module({
  imports: [
    BlockchainModule,
    ConfigModule,
    FulfillmentModule,
    HttpModule,
    LoggingModule,
    ProverModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService, QuoteRegistrationService, QuotesEnabledGuard],
  exports: [],
})
export class QuotesModule {}
