import { Queue } from 'bullmq'
import { BullModule } from '@nestjs/bullmq'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { CheckWithdrawalsCronJobManager } from '@/intent-processor/jobs/withdraw-rewards-cron.job'
import {
  ExecuteWithdrawsJobData,
  ExecuteWithdrawsJobManager,
} from '@/intent-processor/jobs/execute-withdraws.job'
import { CheckSendBatchCronJobManager } from '@/intent-processor/jobs/send-batches-cron.job'
import {
  ExecuteSendBatchJobData,
  ExecuteSendBatchJobManager,
} from '@/intent-processor/jobs/execute-send-batch.job'

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

export const INTENT_PROCESSOR_QUEUE_NAME = 'IntentProcessorQueue'

export class IntentProcessorQueue {
  public static readonly prefix = '{intent-processor}'
  public static readonly queueName = INTENT_PROCESSOR_QUEUE_NAME

  constructor(private readonly queue: IntentProcessorQueueType) {}

  get name() {
    return this.queue.name
  }

  static init() {
    return BullModule.registerQueue({
      name: this.queueName,
      defaultJobOptions: {
        removeOnFail: true,
        removeOnComplete: true,
      },
    })
  }

  @LogOperation('start_withdrawals_cron_jobs', GenericOperationLogger)
  startWithdrawalsCronJobs(@LogContext interval: number) {
    return CheckWithdrawalsCronJobManager.start(this.queue, interval)
  }

  @LogOperation('start_send_batch_cron_jobs', GenericOperationLogger)
  startSendBatchCronJobs(@LogContext interval: number) {
    return CheckSendBatchCronJobManager.start(this.queue, interval)
  }

  @LogOperation('add_execute_withdrawals_jobs', GenericOperationLogger)
  addExecuteWithdrawalsJobs(@LogContext jobsData: ExecuteWithdrawsJobData[]) {
    const jobs = jobsData.map((data) => ExecuteWithdrawsJobManager.createJob(data))
    return this.queue.addBulk(jobs)
  }

  @LogOperation('add_execute_send_batch_jobs', GenericOperationLogger)
  addExecuteSendBatchJobs(@LogContext jobsData: ExecuteSendBatchJobData[]) {
    const jobs = jobsData.map((data) => ExecuteSendBatchJobManager.createJob(data))
    return this.queue.addBulk(jobs)
  }
}
