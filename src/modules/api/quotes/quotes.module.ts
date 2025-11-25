import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { QuotesController } from './controllers/quotes.controller';
import { QuotesService } from './services/quotes.service';
import { SolverRegistrationModule } from '@/modules/api/quotes/solver-registration/solver-registration.module';

@Module({
  imports: [
    BlockchainModule,
    ConfigModule,
    FulfillmentModule,
    HttpModule,
    IntentsModule,
    LoggingModule,
    SolverRegistrationModule,
  ],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
