import { forwardRef, Module } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';

import { SolanaListener } from './listeners/solana.listener';
import { SvmExecutorService } from './svm.executor.service';
import { SvmReaderService } from './svm.reader.service';

@Module({
  imports: [ConfigModule, forwardRef(() => FulfillmentModule)],
  providers: [SvmExecutorService, SvmReaderService, SolanaListener],
  exports: [SvmExecutorService, SvmReaderService, SolanaListener],
})
export class SvmModule {}
