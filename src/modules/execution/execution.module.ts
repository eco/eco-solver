import { Module } from '@nestjs/common';
import { BullMQModule } from '@nestjs/bullmq';
import { ConfigModule } from '@/modules/config/config.module';
import { ExecutionService } from '@/modules/execution/execution.service';
import { ExecutionProcessor } from '@/modules/execution/execution.processor';
import { EvmExecutor } from '@/modules/execution/executors/evm.executor';
import { SolanaExecutor } from '@/modules/execution/executors/solana.executor';
import { IntentsModule } from '@/modules/intents/intents.module';

@Module({
  imports: [
    ConfigModule,
    IntentsModule,
    BullMQModule.registerQueue({
      name: 'wallet-execution',
    }),
  ],
  providers: [
    ExecutionService,
    ExecutionProcessor,
    EvmExecutor,
    SolanaExecutor,
  ],
  exports: [ExecutionService],
})
export class ExecutionModule {}