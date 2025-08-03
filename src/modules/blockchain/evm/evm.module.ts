import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';

import { EvmWalletManager } from './services/evm-wallet-manager.service';
import { EvmExecutorService } from './evm.executor.service';
import { EvmReaderService } from './evm.reader.service';

@Module({
  imports: [ConfigModule, IntentsModule],
  providers: [EvmExecutorService, EvmReaderService, EvmWalletManager],
  exports: [EvmExecutorService, EvmReaderService],
})
export class EvmModule {}
