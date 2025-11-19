import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { GaslessInitiationIntentRepository } from '@/modules/api/gasless-intents/repositories/gasless-initiation-intent.repository';
import { QuotesModule } from '@/modules/api/quotes/quotes.module';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { GaslessIntentsController } from './controllers/gasless-intents.controller';
import {
  GaslessInitiationIntent,
  GaslessInitiationIntentSchema,
} from './schemas/gasless-initiation-intent.schema';
import { GaslessIntentsService } from './services/gasless-intents.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GaslessInitiationIntent.name, schema: GaslessInitiationIntentSchema },
    ]),
    IntentsModule,
    QuotesModule,
    BlockchainModule,
    ConfigModule,
    LoggingModule,
  ],
  controllers: [GaslessIntentsController],
  providers: [GaslessIntentsService, GaslessInitiationIntentRepository],
  exports: [GaslessIntentsService, GaslessInitiationIntentRepository],
})
export class GaslessIntentsModule {}
