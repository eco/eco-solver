import { DynamicModule, Global, Module } from '@nestjs/common';

import { EcoConfigService } from '@/config/eco-config.service';
import { ConfigModule } from '@/modules/config/config.module';
import { EventsModule } from '@/modules/events/events.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { QueueModule } from '@/modules/queue/queue.module';
import { RedisModule } from '@/modules/redis/redis.module';

import { EvmModule } from './evm/evm.module';
import { SvmModule } from './svm/svm.module';
import { TvmModule } from './tvm/tvm.module';
import { BlockchainProcessor } from './blockchain.processor';
import { BlockchainEventsProcessor } from './blockchain-events.processor';
import { BlockchainExecutorService } from './blockchain-executor.service';
import { BlockchainReaderService } from './blockchain-reader.service';

@Global()
@Module({})
export class BlockchainModule {
  static async forRootAsync(): Promise<DynamicModule> {
    const config = await EcoConfigService.loadConfig();

    const imports = [
      ConfigModule,
      EventsModule,
      FulfillmentModule,
      IntentsModule,
      LoggingModule,
      OpenTelemetryModule,
      QueueModule,
      RedisModule,
    ];

    // Only import EVM module if configured with networks
    if (config.evm?.networks?.length > 0) {
      imports.push(EvmModule);
    }

    // Only import SVM module if solana config exists
    if (config.svm) {
      imports.push(SvmModule);
    }

    // Only import TVM module if configured with networks
    if (config.tvm?.networks && config.tvm.networks.length > 0) {
      imports.push(TvmModule);
    }

    return {
      module: BlockchainModule,
      imports,
      providers: [
        BlockchainExecutorService,
        BlockchainReaderService,
        BlockchainProcessor,
        BlockchainEventsProcessor,
      ],
      exports: [BlockchainExecutorService, BlockchainReaderService],
    };
  }
}
