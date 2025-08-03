import { Module, forwardRef } from '@nestjs/common';

import { ConfigModule } from '@/modules/config/config.module';
import { FulfillmentModule } from '@/modules/fulfillment/fulfillment.module';

import { SvmExecutorService } from './svm.executor.service';
import { SvmReaderService } from './svm.reader.service';
import { SolanaListener } from './listeners/solana.listener';

@Module({
  imports: [ConfigModule, forwardRef(() => FulfillmentModule)],
  providers: [SvmExecutorService, SvmReaderService, SolanaListener],
  exports: [SvmExecutorService, SvmReaderService, SolanaListener],
})
export class SvmModule {}
