import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { ProverModule } from '@/modules/prover/prover.module';

import { EvmListenersManagerService } from './listeners/evm-listeners-manager.service';
import { EvmTransportService } from './services/evm-transport.service';
import { EvmWalletManager } from './services/evm-wallet-manager.service';
import { BasicWalletModule } from './wallets/basic-wallet';
import { KernelWalletModule } from './wallets/kernel-wallet';
import { EvmExecutorService } from './evm.executor.service';
import { EvmReaderService } from './evm.reader.service';

@Module({
  imports: [ConfigModule, ProverModule, BasicWalletModule, KernelWalletModule],
  providers: [
    EvmTransportService,
    EvmExecutorService,
    EvmReaderService,
    EvmWalletManager,
    EvmListenersManagerService,
  ],
  exports: [EvmExecutorService, EvmReaderService, EvmTransportService],
})
export class EvmModule {}
