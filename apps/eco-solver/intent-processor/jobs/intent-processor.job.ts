import { BaseJobManager } from '@/common/bullmq/base-job'
import { CheckWithdrawsCronJob } from '@/intent-processor/jobs/withdraw-rewards-cron.job'
import { ExecuteWithdrawsJob } from '@/intent-processor/jobs/execute-withdraws.job'
import { CheckSendBatchJob } from '@/intent-processor/jobs/send-batches-cron.job'
import { ExecuteSendBatchJob } from '@/intent-processor/jobs/execute-send-batch.job'

export type IntentProcessorJob =
  | ExecuteWithdrawsJob
  | CheckWithdrawsCronJob
  | CheckSendBatchJob
  | ExecuteSendBatchJob

export abstract class IntentProcessorJobManager<
  Job extends IntentProcessorJob = IntentProcessorJob,
> extends BaseJobManager<Job> {}
