import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';

import { EvmModule } from './evm/evm.module';
import { SvmModule } from './svm/svm.module';
import { BlockchainProcessor } from './blockchain.processor';
import { BlockchainExecutorService } from './blockchain-executor.service';
import { BlockchainReaderService } from './blockchain-reader.service';

@Module({
  imports: [
    ConfigModule,
    IntentsModule,
    BullModule.registerQueue({
      name: 'blockchain-execution',
    }),
    EvmModule,
    SvmModule,
  ],
  providers: [BlockchainExecutorService, BlockchainReaderService, BlockchainProcessor],
  exports: [BlockchainExecutorService, BlockchainReaderService],
})
export class BlockchainModule {}
