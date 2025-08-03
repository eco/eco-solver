import { Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { IntentsModule } from '@/modules/intents/intents.module';

import { SvmExecutorService } from './svm.executor.service';
import { SvmReaderService } from './svm.reader.service';

@Module({
  imports: [ConfigModule, IntentsModule],
  providers: [SvmExecutorService, SvmReaderService],
  exports: [SvmExecutorService, SvmReaderService],
})
export class SvmModule {}
