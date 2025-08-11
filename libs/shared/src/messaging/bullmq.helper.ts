import { DynamicModule } from '@nestjs/common'
import { BullModule, RegisterQueueOptions } from '@nestjs/bullmq'
import { IEcoConfigService } from "../types/config.types"
import { RedisConnectionUtils } from "../redis/redis-connection-utils"
import { QueueMetadata } from './queue-constants'

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
    useFactory: (configService: IEcoConfigService) => {
      return {
        ...RedisConnectionUtils.getQueueOptions(queueInterface, configService.getRedis()),
        ...opts,
      }
    },
    inject: ["ECO_CONFIG_SERVICE"],
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
    useFactory: (configService: IEcoConfigService) =>
      RedisConnectionUtils.getQueueOptions(queueInterface, configService.getRedis()),
    inject: ["ECO_CONFIG_SERVICE"],
  })
}
