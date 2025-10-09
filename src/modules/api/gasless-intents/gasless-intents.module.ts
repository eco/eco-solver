import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { QuotesModule } from '@/modules/api/quotes/quotes.module';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { GaslessIntentsController } from './controllers/gasless-intents.controller';
import { GaslessInitiation, GaslessInitiationSchema } from './schemas/gasless-initiation.schema';
import { GaslessIntentsService } from './services/gasless-intents.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GaslessInitiation.name, schema: GaslessInitiationSchema }]),
    IntentsModule,
    QuotesModule,
    BlockchainModule,
    ConfigModule,
    LoggingModule,
  ],
  controllers: [GaslessIntentsController],
  providers: [GaslessIntentsService],
  exports: [GaslessIntentsService],
})
export class GaslessIntentsModule {}
