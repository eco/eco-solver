import { BullModule, RegisterQueueOptions } from '@nestjs/bullmq'
import { DynamicModule } from '@nestjs/common'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { RedisConnectionUtils } from '@eco-solver/common/redis/redis-connection-utils'
import { QueueMetadata } from '@eco-solver/common/redis/constants'

/**
 * Initialize the BullMQ queue with the given token and eco configs
 * @param {QueueMetadata} queueInterface queue interface
 * @param {Partial<RegisterQueueOptions>} opts queue options
 * @returns
 */
export function initBullMQ(
  queueInterface: QueueMetadata,
  opts?: Partial<RegisterQueueOptions>,
): DynamicModule {
  return BullModule.registerQueueAsync({
    name: queueInterface.queue,
    useFactory: (configService: EcoConfigService) => {
      return {
        ...RedisConnectionUtils.getQueueOptions(queueInterface, configService.getRedis()),
        ...opts,
      }
    },
    inject: [EcoConfigService],
  })
}

/**
 * Initialize the BullMQ flow with the given name and eco configs
 * @param {QueueMetadata} queueInterface queue interface
 * @returns
 */
export function initFlowBullMQ(queueInterface: QueueMetadata): DynamicModule {
  return BullModule.registerFlowProducerAsync({
    name: queueInterface.queue,
    useFactory: (configService: EcoConfigService) =>
      RedisConnectionUtils.getQueueOptions(queueInterface, configService.getRedis()),
    inject: [EcoConfigService],
  })
}
