import { Queue } from 'bullmq'
import { Logger } from '@nestjs/common'

export interface ILiquidityManagerProcessor {
  queue: Queue
  logger: Logger
  cctpv2ProviderService: any // Will be properly typed when we extract to libraries
}

export interface IExecuteCCTPV2MintJobManager {
  start(queue: Queue, data: any): Promise<void>
}
