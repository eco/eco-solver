import { Module } from '@nestjs/common';

import { IntentsModule } from '@/modules/intents/intents.module';
import { EvmListener } from '@/modules/on-chain-listener/listeners/evm.listener';
import { SolanaListener } from '@/modules/on-chain-listener/listeners/solana.listener';
import { OnChainListenerService } from '@/modules/on-chain-listener/on-chain-listener.service';
import { QueueModule } from '@/modules/queue/queue.module';

@Module({
  imports: [QueueModule, IntentsModule],
  providers: [OnChainListenerService, EvmListener, SolanaListener],
  exports: [OnChainListenerService],
})
export class OnChainListenerModule {}
