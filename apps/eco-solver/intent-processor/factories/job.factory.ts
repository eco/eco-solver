import { CheckWithdrawalsCronJobManager } from '@/intent-processor/jobs/withdraw-rewards-cron.job'
import { ExecuteWithdrawsJobManager } from '@/intent-processor/jobs/execute-withdraws.job'
import { ExecuteWithdrawsJobData } from '@/intent-processor/types'
import { CheckSendBatchCronJobManager } from '@/intent-processor/jobs/send-batches-cron.job'
import { ExecuteSendBatchJobManager } from '@/intent-processor/jobs/execute-send-batch.job'
import { ExecuteSendBatchJobData } from '@/intent-processor/types'
import { IntentProcessorQueueType } from '@/intent-processor/types/queue.types'

/**
 * Factory for creating intent processor jobs to break circular dependencies between queue and job files
 */
export class IntentProcessorJobFactory {
  constructor(private readonly queue: IntentProcessorQueueType) {}

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