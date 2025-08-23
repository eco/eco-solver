import { BaseJobManager } from '../../common/bullmq/base-job'
import { CheckWithdrawsCronJob } from './withdraw-rewards-cron.job'
import { ExecuteWithdrawsJob } from './execute-withdraws.job'
import { CheckSendBatchJob } from './send-batches-cron.job'
import { ExecuteSendBatchJob } from './execute-send-batch.job'

export type IntentProcessorJob =
  | ExecuteWithdrawsJob
  | CheckWithdrawsCronJob
  | CheckSendBatchJob
  | ExecuteSendBatchJob

export abstract class IntentProcessorJobManager<
  Job extends IntentProcessorJob = IntentProcessorJob,
> extends BaseJobManager<Job> {}
