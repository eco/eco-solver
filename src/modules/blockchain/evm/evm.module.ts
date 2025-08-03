import { forwardRef, Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';

import { EvmListenersManagerService } from './listeners/evm-listeners-manager.service';
import { EvmTransportService } from './services/evm-transport.service';
import { EvmWalletManager } from './services/evm-wallet-manager.service';
import { BasicWalletFactory } from './wallets/basic-wallet';
import { KernelWalletFactory } from './wallets/kernel-wallet';
import { EvmExecutorService } from './evm.executor.service';
import { EvmReaderService } from './evm.reader.service';

@Module({
  imports: [ConfigModule, forwardRef(() => FulfillmentModule)],
  providers: [
    EvmTransportService,
    EvmExecutorService,
    EvmReaderService,
    EvmWalletManager,
    BasicWalletFactory,
    KernelWalletFactory,
    EvmListenersManagerService,
  ],
  exports: [EvmExecutorService, EvmReaderService],
})
export class EvmModule {}
