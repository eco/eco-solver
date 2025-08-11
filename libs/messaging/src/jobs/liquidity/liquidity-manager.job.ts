import { Job } from 'bullmq'
import { BaseJob, BaseJobManager } from '@libs/messaging'
import {
  LiquidityManagerQueueDataType,
  LiquidityManagerJobName,
} from '../queues/liquidity-manager.queue'

export type LiquidityManagerJob<
  NameType extends LiquidityManagerJobName = LiquidityManagerJobName,
  DataType extends LiquidityManagerQueueDataType = LiquidityManagerQueueDataType,
  ReturnData = unknown,
> = Job<DataType, ReturnData, NameType>

export abstract class LiquidityManagerJobManager<
  Job extends LiquidityManagerJob = LiquidityManagerJob,
> extends BaseJobManager<Job> {}
