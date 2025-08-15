import { BaseJobManager } from '@/common/bullmq/base-job'
import { IntentProcessorJobType } from './job.types'
import { IntentProcessorInterface } from './processor.interface'

export abstract class IntentProcessorJobManager<
  Job extends IntentProcessorJobType = IntentProcessorJobType,
> extends BaseJobManager<Job, IntentProcessorInterface> {}