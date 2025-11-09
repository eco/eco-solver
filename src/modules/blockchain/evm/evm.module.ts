import { DynamicModule, Module } from '@nestjs/common';

import { configurationFactory } from '@/config/configuration-factory';
import { EVMController } from '@/modules/blockchain/evm/evm.controller';
import { BasicWalletModule } from '@/modules/blockchain/evm/wallets/basic-wallet';
import { KernelWalletModule } from '@/modules/blockchain/evm/wallets/kernel-wallet/kernel-wallet.module';
import { ConfigModule } from '@/modules/config/config.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { RedisModule } from '@/modules/redis/redis.module';

import { IndexerModule } from './indexer/indexer.module';
import { EvmListenersManagerService } from './listeners/evm-listeners-manager.service';
import { EvmExecutorService } from './services/evm.executor.service';
import { EvmReaderService } from './services/evm.reader.service';
import { EvmWalletManager } from './services/evm-wallet-manager.service';
import { EvmCoreModule } from './evm-core.module';

@Module({})
export class EvmModule {
  static async forRootAsync(): Promise<DynamicModule> {
    const config = await configurationFactory();

    const imports = [
      ConfigModule,
      LoggingModule,
      OpenTelemetryModule,
      RedisModule,
      EvmCoreModule,
      BasicWalletModule,
      KernelWalletModule,
    ];

    // Conditionally import IndexerModule only if configured
    if (config.evm?.indexer) {
      imports.push(IndexerModule);
    }

    return {
      module: EvmModule,
      controllers: [EVMController],
      imports,
      providers: [
        EvmExecutorService,
        EvmReaderService,
        EvmWalletManager,
        EvmListenersManagerService,
      ],
      exports: [EvmExecutorService, EvmReaderService, EvmWalletManager],
    };
  }
}
