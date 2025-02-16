import { Job } from 'bullmq'
import { WithdrawsJobName, WithdrawsQueueDataType } from '@/withdraws/queues/withdraws.queue'
import { BaseJobManager } from '@/common/bullmq/base-job'

export type WithdrawsJob<
  NameType extends WithdrawsJobName = WithdrawsJobName,
  DataType extends WithdrawsQueueDataType = WithdrawsQueueDataType,
> = Job<DataType, unknown, NameType>

export abstract class WithdrawsJobManager<
  Job extends WithdrawsJob = WithdrawsJob,
> extends BaseJobManager<Job> {}
