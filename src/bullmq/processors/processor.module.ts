import { Module } from '@nestjs/common'
import { EthWebsocketProcessor } from './eth-ws.processor'
import { SignerProcessor } from './signer.processor'
import { SolveIntentProcessor } from './solve-intent.processor'
import { BalanceModule } from '../../balance/balance.module'
import { IntentModule } from '../../intent/intent.module'
import { SignModule } from '../../sign/sign.module'
import { InboxProcessor } from '@/bullmq/processors/inbox.processor'
import { NegativeIntentsModule } from '@/negative-intents/negative-intents.module'

@Module({
  imports: [BalanceModule, IntentModule, SignModule, NegativeIntentsModule],
  providers: [EthWebsocketProcessor, SignerProcessor, SolveIntentProcessor, InboxProcessor],
})
export class ProcessorModule {}
