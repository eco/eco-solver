import { Module } from '@nestjs/common'
import { EthWebsocketProcessor } from './eth-ws.processor'
import { SignerProcessor } from './signer.processor'
import { SolveIntentProcessor } from './solve-intent.processor'
import { BalanceModule } from '../../balance/balance.module'
import { IntentModule } from '../../intent/intent.module'
import { SignModule } from '../../sign/sign.module'
import { InboxProcessor } from '@/bullmq/processors/inbox.processor'
import { SolanaIntentProcessor } from './solana-intent.processor'

@Module({
  imports: [BalanceModule, IntentModule, SignModule],
  providers: [
    EthWebsocketProcessor,
    SignerProcessor,
    SolveIntentProcessor,
    InboxProcessor,
    SolanaIntentProcessor,
  ],
})
export class ProcessorModule {}
