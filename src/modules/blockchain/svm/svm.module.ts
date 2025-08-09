import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { LoggingModule } from '@/modules/logging/logging.module';

import { SolanaListener } from './listeners/solana.listener';
import { SvmExecutorService } from './services/svm.executor.service';
import { SvmReaderService } from './services/svm.reader.service';

@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [SvmExecutorService, SvmReaderService, SolanaListener],
  exports: [SvmExecutorService, SvmReaderService, SolanaListener],
})
export class SvmModule {}
