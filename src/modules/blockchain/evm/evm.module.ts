import { Module, forwardRef } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';

import { EvmWalletManager } from './services/evm-wallet-manager.service';
import { EvmTransportService } from './services/evm-transport.service';
import { EvmExecutorService } from './evm.executor.service';
import { EvmReaderService } from './evm.reader.service';
import { EvmListener } from './listeners/evm.listener';

@Module({
  imports: [ConfigModule, forwardRef(() => FulfillmentModule)],
  providers: [EvmTransportService, EvmExecutorService, EvmReaderService, EvmWalletManager, EvmListener],
  exports: [EvmExecutorService, EvmReaderService, EvmListener],
})
export class EvmModule {}
