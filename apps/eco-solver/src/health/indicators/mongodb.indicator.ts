import { Injectable, Logger } from '@nestjs/common'
import { HealthIndicatorResult, MongooseHealthIndicator } from '@nestjs/terminus'

@Injectable()
export class MongoDBHealthIndicator extends MongooseHealthIndicator {
  private logger = new Logger(MongoDBHealthIndicator.name)

  async checkMongoDB(): Promise<HealthIndicatorResult> {
    return this.pingCheck('mongoDB')
  }
}
