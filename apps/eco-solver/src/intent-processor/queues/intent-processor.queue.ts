import { Queue } from 'bullmq'
import { initBullMQ } from '../../bullmq/bullmq.helper'
import { CheckWithdrawalsCronJobManager } from '../jobs/withdraw-rewards-cron.job'
import {
  ExecuteWithdrawsJobData,
  ExecuteWithdrawsJobManager,
} from '../jobs/execute-withdraws.job'
import { CheckSendBatchCronJobManager } from '../jobs/send-batches-cron.job'
import {
  ExecuteSendBatchJobData,
  ExecuteSendBatchJobManager,
} from '../jobs/execute-send-batch.job'

export enum IntentProcessorJobName {
  CHECK_WITHDRAWS = 'CHECK_WITHDRAWS',
  CHECK_SEND_BATCH = 'CHECK_SEND_BATCH',
  EXECUTE_WITHDRAWS = 'EXECUTE_WITHDRAWS',
  EXECUTE_SEND_BATCH = 'EXECUTE_SEND_BATCH',
}

export type IntentProcessorQueueDataType = any

export type IntentProcessorQueueType = Queue<
  IntentProcessorQueueDataType,
  unknown,
  IntentProcessorJobName
>

export class IntentProcessorQueue {
  public static readonly prefix = '{intent-processor}'
  public static readonly queueName = IntentProcessorQueue.name

  constructor(private readonly queue: IntentProcessorQueueType) {}

  get name() {
    return this.queue.name
  }

  static init() {
    return initBullMQ(
      { queue: this.queueName, prefix: IntentProcessorQueue.prefix },
      {
        defaultJobOptions: {
          removeOnFail: true,
          removeOnComplete: true,
        },
      },
    )
  }

  startWithdrawalsCronJobs(interval: number) {
    return CheckWithdrawalsCronJobManager.start(this.queue, interval)
  }

  startSendBatchCronJobs(interval: number) {
    return CheckSendBatchCronJobManager.start(this.queue, interval)
  }

  addExecuteWithdrawalsJobs(jobsData: ExecuteWithdrawsJobData[]) {
    const jobs = jobsData.map((data) => ExecuteWithdrawsJobManager.createJob(data))
    return this.queue.addBulk(jobs)
  }

  addExecuteSendBatchJobs(jobsData: ExecuteSendBatchJobData[]) {
    const jobs = jobsData.map((data) => ExecuteSendBatchJobManager.createJob(data))
    return this.queue.addBulk(jobs)
  }
}
