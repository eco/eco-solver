import { Injectable, Logger } from '@nestjs/common'
import { HealthIndicatorResult } from '@nestjs/terminus'
import { RedisHealthIndicator } from '@liaoliaots/nestjs-redis-health'
import { EcoConfigService } from '@libs/integrations'
import { RedisConnectionUtils } from '@libs/messaging'

@Injectable()
export class EcoRedisHealthIndicator extends RedisHealthIndicator {
  private logger = new Logger(EcoRedisHealthIndicator.name)
  private readonly redis: any
  constructor(private readonly configService: EcoConfigService) {
    super()
    const serviceConfig = configService.getRedis()
    this.redis = RedisConnectionUtils.getRedisConnection(serviceConfig)
  }
  async checkRedis(): Promise<HealthIndicatorResult> {
    return this.checkHealth('redis', {
      type: 'redis',
      client: this.redis,
      timeout: 1000,
    })
  }
}
