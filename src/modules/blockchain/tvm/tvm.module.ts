import { Module } from '@nestjs/common';

import { ProverModule } from '@/modules/prover/prover.module';

import { TvmListenersManagerService } from './listeners/tvm-listeners-manager.service';
import { BasicWalletModule } from './wallets/basic-wallet';
import { TvmExecutorService, TvmReaderService, TvmWalletManagerService } from './services';

@Module({
  imports: [BasicWalletModule, ProverModule],
  providers: [
    TvmReaderService,
    TvmExecutorService,
    TvmWalletManagerService,
    TvmListenersManagerService,
  ],
  exports: [TvmReaderService, TvmExecutorService],
})
export class TvmModule {}
