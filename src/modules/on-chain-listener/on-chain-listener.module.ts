import { Module } from '@nestjs/common';
import { OnChainListenerService } from '@/modules/on-chain-listener/on-chain-listener.service';
import { EvmListener } from '@/modules/on-chain-listener/listeners/evm.listener';
import { SolanaListener } from '@/modules/on-chain-listener/listeners/solana.listener';
import { QueueModule } from '@/modules/queue/queue.module';
import { IntentsModule } from '@/modules/intents/intents.module';

@Module({
  imports: [QueueModule, IntentsModule],
  providers: [OnChainListenerService, EvmListener, SolanaListener],
  exports: [OnChainListenerService],
})
export class OnChainListenerModule {}