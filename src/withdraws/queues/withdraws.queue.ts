import { Queue } from 'bullmq'
import { initBullMQ } from '@/bullmq/bullmq.helper'
import { WithdrawRewardsCronJobManager } from '@/withdraws/jobs/withdraw-rewards-cron.job'
import {
  ExecuteWithdrawsJobData,
  ExecuteWithdrawsJobManager,
} from '@/withdraws/jobs/execute-withdraws.job'

export enum WithdrawsJobName {
  EXECUTE_WITHDRAWS = 'EXECUTE_WITHDRAWS',
  CHECK_WITHDRAWS = 'CHECK_WITHDRAWS',
}

export type WithdrawsQueueDataType = any

export type WithdrawsQueueType = Queue<WithdrawsQueueDataType, unknown, WithdrawsJobName>

export class WithdrawsQueue {
  public static readonly prefix = '{withdraws}'
  public static readonly queueName = WithdrawsQueue.name

  constructor(private readonly queue: WithdrawsQueueType) {}

  get name() {
    return this.queue.name
  }

  static init() {
    return initBullMQ(
      { queue: this.queueName, prefix: WithdrawsQueue.prefix },
      {
        defaultJobOptions: {
          removeOnFail: true,
          removeOnComplete: true,
        },
      },
    )
  }

  startCronJobs(interval: number) {
    return WithdrawRewardsCronJobManager.start(this.queue, interval)
  }

  addExecuteWithdrawalsJobs(jobsData: ExecuteWithdrawsJobData[]) {
    const jobs = jobsData.map((data) => ExecuteWithdrawsJobManager.createJob(data))
    return this.queue.addBulk(jobs)
  }
}
