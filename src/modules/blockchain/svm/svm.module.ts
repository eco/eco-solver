import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';
import { QueueModule } from '@/modules/queue/queue.module';

import { SvmExecutorService } from './svm.executor.service';
import { SvmReaderService } from './svm.reader.service';
import { SolanaListener } from './listeners/solana.listener';

@Module({
  imports: [ConfigModule, IntentsModule, QueueModule],
  providers: [SvmExecutorService, SvmReaderService, SolanaListener],
  exports: [SvmExecutorService, SvmReaderService, SolanaListener],
})
export class SvmModule {}
