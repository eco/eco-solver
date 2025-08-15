import { BaseJobManager } from '@/common/bullmq/base-job'
import { LiquidityManagerJobType } from './job.types'
import { LiquidityManagerProcessorInterface } from './processor.interface'

export abstract class LiquidityManagerJobManager<
  Job extends LiquidityManagerJobType = LiquidityManagerJobType,
> extends BaseJobManager<Job, LiquidityManagerProcessorInterface> {}