import { Module } from '@nestjs/common'
import { EthWebsocketProcessor } from './eth-ws.processor'
import { SignerProcessor } from './signer.processor'
import { SolveIntentProcessor } from './solve-intent.processor'
import { BalanceModule } from '../../balance/balance.module'
import { IntentModule } from '../../intent/intent.module'
import { SignModule } from '../../sign/sign.module'
import { InboxProcessor } from '@/bullmq/processors/inbox.processor'
import { HatsProcessor } from '@/bullmq/processors/hats.processor'
import { HatsModule } from '@/hats/hats.module'

@Module({
  imports: [
    BalanceModule,
    IntentModule,
    SignModule,
    HatsModule
  ],
  providers: [
    EthWebsocketProcessor,
    SignerProcessor,
    SolveIntentProcessor,
    InboxProcessor,
    HatsProcessor
  ],
})
export class ProcessorModule {}
