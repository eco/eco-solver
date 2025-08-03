import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { QueueModule } from '@/modules/queue/queue.module';

import { EvmWalletManager } from './services/evm-wallet-manager.service';
import { EvmExecutorService } from './evm.executor.service';
import { EvmReaderService } from './evm.reader.service';
import { EvmListener } from './listeners/evm.listener';

@Module({
  imports: [ConfigModule, IntentsModule, QueueModule],
  providers: [EvmExecutorService, EvmReaderService, EvmWalletManager, EvmListener],
  exports: [EvmExecutorService, EvmReaderService, EvmListener],
})
export class EvmModule {}
