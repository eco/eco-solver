import { forwardRef, Module } from '@nestjs/common';

import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';
import { ProverModule } from '@/modules/prover/prover.module';

import { TvmListenersManagerService } from './listeners/tvm-listeners-manager.service';
import { BasicWalletModule } from './wallets/basic-wallet';
import {
  TvmExecutorService,
  TvmReaderService,
  TvmUtilsService,
  TvmWalletManagerService,
} from './services';

@Module({
  imports: [BasicWalletModule, ProverModule, forwardRef(() => FulfillmentModule)],
  providers: [
    TvmUtilsService,
    TvmReaderService,
    TvmExecutorService,
    TvmWalletManagerService,
    TvmListenersManagerService,
  ],
  exports: [TvmReaderService, TvmExecutorService],
})
export class TvmModule {}
