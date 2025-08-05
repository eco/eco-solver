import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';

import { SolanaListener } from './listeners/solana.listener';
import { SvmExecutorService } from './services/svm.executor.service';
import { SvmReaderService } from './services/svm.reader.service';

@Module({
  imports: [ConfigModule],
  providers: [SvmExecutorService, SvmReaderService, SolanaListener],
  exports: [SvmExecutorService, SvmReaderService, SolanaListener],
})
export class SvmModule {}
