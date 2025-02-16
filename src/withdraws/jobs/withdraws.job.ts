import { BaseJobManager } from '@/common/bullmq/base-job'
import { CheckWithdrawsJob } from '@/withdraws/jobs/withdraw-rewards-cron.job'
import { ExecuteWithdrawsJob } from '@/withdraws/jobs/execute-withdraws.job'

export type WithdrawsJob = ExecuteWithdrawsJob | CheckWithdrawsJob

export abstract class WithdrawsJobManager<
  Job extends WithdrawsJob = WithdrawsJob,
> extends BaseJobManager<Job> {}
