import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Global, Module } from '@nestjs/common';

import { configurationFactory } from '@/config/configuration-factory';
import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { QueueNames } from '@/modules/queue/enums/queue-names.enum';

import { EvmModule } from './evm/evm.module';
import { SvmModule } from './svm/svm.module';
import { TvmModule } from './tvm/tvm.module';
import { BlockchainProcessor } from './blockchain.processor';
import { BlockchainExecutorService } from './blockchain-executor.service';
import { BlockchainReaderService } from './blockchain-reader.service';

@Global()
@Module({})
export class BlockchainModule {
  static async forRootAsync(): Promise<DynamicModule> {
    const configFactory = await configurationFactory();

    const imports = [
      ConfigModule,
      IntentsModule,
      LoggingModule,
      BullModule.registerQueue({
        name: QueueNames.INTENT_EXECUTION,
      }),
    ];

    // Only import EVM module if configured with networks
    if (configFactory.evm?.networks?.length > 0) {
      imports.push(EvmModule);
    }

    // Only import SVM module if solana config exists
    if (configFactory.solana) {
      imports.push(SvmModule);
    }

    // Only import TVM module if configured with networks
    if (configFactory.tvm?.networks?.length > 0) {
      imports.push(TvmModule);
    }

    return {
      module: BlockchainModule,
      imports,
      providers: [BlockchainExecutorService, BlockchainReaderService, BlockchainProcessor],
      exports: [BlockchainExecutorService, BlockchainReaderService],
    };
  }
}
