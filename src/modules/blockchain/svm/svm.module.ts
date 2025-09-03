import { forwardRef, Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { LoggingModule } from '@/modules/logging/logging.module';
import { ProverModule } from '@/modules/prover/prover.module';

import { SolanaListener } from './listeners/solana.listener';
import { SvmExecutorService } from './services/svm.executor.service';
import { SvmReaderService } from './services/svm.reader.service';
import { SvmWalletManagerService } from './services/svm-wallet-manager.service';
import { BasicWalletModule } from './wallets/basic-wallet';

@Module({
  imports: [ConfigModule, LoggingModule, BasicWalletModule, forwardRef(() => ProverModule)],
  providers: [SvmExecutorService, SvmReaderService, SvmWalletManagerService, SolanaListener],
  exports: [SvmExecutorService, SvmReaderService, SvmWalletManagerService, SolanaListener],
})
export class SvmModule {}
