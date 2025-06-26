import { Module } from '@nestjs/common'
import { SignerProcessor } from './signer.processor'
import { SolveIntentProcessor } from './solve-intent.processor'
import { IntentModule } from '@/intent/intent.module'
import { SignModule } from '@/sign/sign.module'
import { InboxProcessor } from '@/bullmq/processors/inbox.processor'
import { BalanceModule } from '@/balance/balance.module'

@Module({
  imports: [BalanceModule, IntentModule, SignModule],
  providers: [SignerProcessor, SolveIntentProcessor, InboxProcessor],
})
export class ProcessorModule {}
