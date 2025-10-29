import { Module } from '@nestjs/common'
import { BullBoardModule as BaseBullBoardModule } from '@bull-board/nestjs'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { Queue } from 'bullmq'
import { EcoConfigModule } from '@/eco-configs/eco-config.module'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RedisConnectionUtils } from '@/common/redis/redis-connection-utils'
import { QUEUES } from '@/common/redis/constants'
import { IntentFulfillmentQueue } from '@/intent-fulfillment/queues/intent-fulfillment.queue'
import { LiquidityManagerQueue } from '@/liquidity-manager/queues/liquidity-manager.queue'
import { CheckBalancesQueue } from '@/liquidity-manager/queues/check-balances.queue'
import { IntentProcessorQueue } from '@/intent-processor/queues/intent-processor.queue'

@Module({
  imports: [
    EcoConfigModule,
    BaseBullBoardModule.forRootAsync({
      imports: [EcoConfigModule],
      inject: [EcoConfigService],
      useFactory: async (configService: EcoConfigService) => {
        const redisConfig = configService.getRedis()
        const connection = RedisConnectionUtils.getRedisConnection(redisConfig)
        const queues: Queue[] = []

        // Create Queue instances for all queues
        // Modern queues
        queues.push(
          new Queue(IntentFulfillmentQueue.queueName, {
            prefix: IntentFulfillmentQueue.prefix,
            connection,
          }),
        )

        queues.push(
          new Queue(LiquidityManagerQueue.queueName, {
            prefix: LiquidityManagerQueue.prefix,
            connection,
          }),
        )

        queues.push(
          new Queue(CheckBalancesQueue.queueName, {
            prefix: CheckBalancesQueue.prefix,
            connection,
          }),
        )

        queues.push(
          new Queue(IntentProcessorQueue.queueName, {
            prefix: IntentProcessorQueue.prefix,
            connection,
          }),
        )

        // Legacy queues
        queues.push(
          new Queue(QUEUES.SOURCE_INTENT.queue, {
            prefix: QUEUES.SOURCE_INTENT.prefix,
            connection,
          }),
        )

        queues.push(
          new Queue(QUEUES.INTERVAL.queue, {
            prefix: QUEUES.INTERVAL.prefix,
            connection,
          }),
        )

        queues.push(
          new Queue(QUEUES.INBOX.queue, {
            prefix: QUEUES.INBOX.prefix,
            connection,
          }),
        )

        queues.push(
          new Queue(QUEUES.ETH_SOCKET.queue, {
            prefix: QUEUES.ETH_SOCKET.prefix,
            connection,
          }),
        )

        queues.push(
          new Queue(QUEUES.SIGNER.queue, {
            prefix: QUEUES.SIGNER.prefix,
            connection,
          }),
        )

        queues.push(
          new Queue(QUEUES.SOLVER.queue, {
            prefix: QUEUES.SOLVER.prefix,
            connection,
          }),
        )

        return {
          route: '/admin/queues',
          adapter: ExpressAdapter,
          queues: queues.map((queue) => ({
            name: queue.name,
            adapter: BullMQAdapter,
            options: { readOnlyMode: true },
          })),
          boardOptions: {
            uiConfig: {
              boardTitle: 'Eco Solver - Queue Dashboard',
              boardLogo: {
                path: '',
                width: 0,
                height: 0,
              },
            },
          },
        }
      },
    }),
  ],
})
export class BullBoardModule {}
