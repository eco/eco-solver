import { Module } from '@nestjs/common'
import { BullBoardModule as BaseBullBoardModule } from '@bull-board/nestjs'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { IntentFulfillmentQueue } from '@/intent-fulfillment/queues/intent-fulfillment.queue'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CheckBalancesQueue } from '@/liquidity-manager/queues/check-balances.queue'
import { IntentProcessorQueue } from '@/intent-processor/queues/intent-processor.queue'
import { QUEUES } from '@/common/redis/constants'

// Array of queue names to register with Bull Board
const QUEUES_TO_MONITOR = [
  // Modern queues
  IntentFulfillmentQueue.queueName,
  LiquidityManagerQueue.queueName,
  CheckBalancesQueue.queueName,
  IntentProcessorQueue.queueName,
  // Legacy queues
  QUEUES.SOURCE_INTENT.queue,
  QUEUES.INTERVAL.queue,
  QUEUES.INBOX.queue,
  QUEUES.ETH_SOCKET.queue,
  QUEUES.SIGNER.queue,
]

@Module({
  imports: [
    BaseBullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
      boardOptions: {
        uiConfig: {
          boardTitle: 'Eco Solver - Queue Dashboard',
        },
      },
    }),
    ...QUEUES_TO_MONITOR.map((queueName) =>
      BaseBullBoardModule.forFeature({
        name: queueName,
        adapter: BullMQAdapter,
        options: {
          readOnlyMode: true,
          allowRetries: true,
        },
      }),
    ),
  ],
})
export class BullBoardModule {}
