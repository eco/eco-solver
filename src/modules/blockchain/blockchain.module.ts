import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';

import { configurationFactory } from '@/config/configuration-factory';
import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';

import { EvmModule } from './evm/evm.module';
import { SvmModule } from './svm/svm.module';
import { BlockchainProcessor } from './blockchain.processor';
import { BlockchainExecutorService } from './blockchain-executor.service';
import { BlockchainReaderService } from './blockchain-reader.service';

@Module({})
export class BlockchainModule {
  static async forRootAsync(): Promise<DynamicModule> {
    const configFactory = await configurationFactory();

    const imports: any[] = [
      ConfigModule,
      IntentsModule,
      BullModule.registerQueue({
        name: 'blockchain-execution',
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

    return {
      module: BlockchainModule,
      imports,
      providers: [BlockchainExecutorService, BlockchainReaderService, BlockchainProcessor],
      exports: [BlockchainExecutorService, BlockchainReaderService],
    };
  }
}
