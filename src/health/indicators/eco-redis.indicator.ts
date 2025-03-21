import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { HealthIndicatorResult } from '@nestjs/terminus'
import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { RedisConnectionUtils } from '../../common/redis/redis-connection-utils'
import { EcoLogMessage } from '@/common/logging/eco-log-message'

@Injectable()
export class EcoRedisHealthIndicator extends RedisHealthIndicator implements OnModuleInit {
  private logger = new Logger(EcoRedisHealthIndicator.name)
  private readonly redis: ReturnType<typeof RedisConnectionUtils.getRedisConnection>
  constructor(private readonly configService: EcoConfigService) {
    super()
    const serviceConfig = configService.getRedis()
    this.redis = RedisConnectionUtils.getRedisConnection(serviceConfig)
  }

  async onModuleInit() {
    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Redis connection flushing all...',
      }),
    )
    const result = await this.redis.flushall()

    this.logger.log(
      EcoLogMessage.fromDefault({
        message: 'Redis connection flushall command executed!',
        properties: { result },
      }),
    )
  }

  async checkRedis(): Promise<HealthIndicatorResult> {
    return this.checkHealth('redis', {
      type: 'redis',
      client: this.redis as any,
      timeout: 1000,
    })
  }
}
