import { Module } from '@nestjs/common'
import { EthWebsocketProcessor } from './eth-ws.processor'
import { SolveIntentProcessor } from './solve-intent.processor'
import { InboxProcessor } from './inbox.processor'
import { IntervalProcessor } from './interval.processor'

// Note: SignerProcessor moved to @libs/security
@Module({
  providers: [EthWebsocketProcessor, SolveIntentProcessor, InboxProcessor, IntervalProcessor],
  exports: [EthWebsocketProcessor, SolveIntentProcessor, InboxProcessor, IntervalProcessor]
})
export class ProcessorModule {}
