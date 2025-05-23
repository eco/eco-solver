import { Job } from 'bullmq'
import { BaseJobManager } from '@/common/bullmq/base-job'
import {
  LiquidityManagerQueueDataType,
  LiquidityManagerJobName,
} from '@/liquidity-manager/queues/liquidity-manager.queue'

export type LiquidityManagerJob<
  NameType extends LiquidityManagerJobName = LiquidityManagerJobName,
  DataType extends LiquidityManagerQueueDataType = LiquidityManagerQueueDataType,
  ReturnData = unknown,
> = Job<DataType, ReturnData, NameType>

export abstract class LiquidityManagerJobManager<
  Job extends LiquidityManagerJob = LiquidityManagerJob,
> extends BaseJobManager<Job> {}
