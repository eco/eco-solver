import { Module } from '@nestjs/common';

import { BasicWalletModule } from '@/modules/blockchain/evm/wallets';
import { KernelWalletModule } from '@/modules/blockchain/evm/wallets';
import { ConfigModule } from '@/modules/config/config.module';

import { EvmListenersManagerService } from './listeners/evm-listeners-manager.service';
import { EvmExecutorService } from './services/evm.executor.service';
import { EvmReaderService } from './services/evm.reader.service';
import { EvmWalletManager } from './services/evm-wallet-manager.service';
import { EvmCoreModule } from './evm-core.module';

@Module({
  imports: [ConfigModule, EvmCoreModule, BasicWalletModule, KernelWalletModule],
  providers: [EvmExecutorService, EvmReaderService, EvmWalletManager, EvmListenersManagerService],
  exports: [EvmExecutorService, EvmReaderService],
})
export class EvmModule {}
