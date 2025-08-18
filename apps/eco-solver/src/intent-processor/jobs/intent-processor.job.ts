import { BaseJobManager } from '@eco-solver/common/bullmq/base-job'
import { CheckWithdrawsCronJob } from '@eco-solver/intent-processor/jobs/withdraw-rewards-cron.job'
import { ExecuteWithdrawsJob } from '@eco-solver/intent-processor/jobs/execute-withdraws.job'
import { CheckSendBatchJob } from '@eco-solver/intent-processor/jobs/send-batches-cron.job'
import { ExecuteSendBatchJob } from '@eco-solver/intent-processor/jobs/execute-send-batch.job'

export type IntentProcessorJob =
  | ExecuteWithdrawsJob
  | CheckWithdrawsCronJob
  | CheckSendBatchJob
  | ExecuteSendBatchJob

export abstract class IntentProcessorJobManager<
  Job extends IntentProcessorJob = IntentProcessorJob,
> extends BaseJobManager<Job> {}
