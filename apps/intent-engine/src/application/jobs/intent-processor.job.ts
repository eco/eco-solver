export type IntentProcessorJob =
  | ExecuteWithdrawsJob
  | CheckWithdrawsCronJob
  | CheckSendBatchJob
  | ExecuteSendBatchJob

export abstract class IntentProcessorJobManager<
  Job extends IntentProcessorJob = IntentProcessorJob,
> extends BaseJobManager<Job> {}
