import { forwardRef, Module } from '@nestjs/common';

import { LoggingModule } from '@/modules/logging/logging.module';
import { OpenTelemetryModule } from '@/modules/opentelemetry/opentelemetry.module';
import { ProverModule } from '@/modules/prover/prover.module';

import { TvmListenersManagerService } from './listeners/tvm-listeners-manager.service';
import { BasicWalletModule } from './wallets/basic-wallet';
import { TvmExecutorService, TvmReaderService, TvmWalletManagerService } from './services';

@Module({
  imports: [BasicWalletModule, forwardRef(() => ProverModule), LoggingModule, OpenTelemetryModule],
  providers: [
    TvmReaderService,
    TvmExecutorService,
    TvmWalletManagerService,
    TvmListenersManagerService,
  ],
  exports: [TvmReaderService, TvmExecutorService],
})
export class TvmModule {}
