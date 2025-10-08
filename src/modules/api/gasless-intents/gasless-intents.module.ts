import { Module } from '@nestjs/common';

import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { GaslessIntentsController } from './controllers/gasless-intents.controller';
import { GaslessIntentsService } from './services/gasless-intents.service';

@Module({
  imports: [IntentsModule, BlockchainModule, ConfigModule, LoggingModule],
  controllers: [GaslessIntentsController],
  providers: [GaslessIntentsService],
  exports: [GaslessIntentsService],
})
export class GaslessIntentsModule {}
