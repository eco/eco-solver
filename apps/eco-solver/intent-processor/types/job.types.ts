import { Job } from 'bullmq'
import { Hex } from 'viem'
import { Serialize } from '@/common/utils/serialize'
import { IntentProcessorJobName } from '@/intent-processor/constants/job-names'
import { IntentType } from '@eco/foundation-eco-adapter'

// Base type for all intent processor jobs
export type BaseIntentProcessorJob<
  TName extends IntentProcessorJobName = IntentProcessorJobName,
  TData = unknown,
  TReturn = unknown,
> = Job<TData, TReturn, TName>

// Specific job data types
export interface ProveIntentData {
  hash: Hex
  prover: Hex
  source: number
  intentSourceAddr: Hex
  inbox: Hex
}

export type ExecuteSendBatchJobData = {
  chainId: number
  intentSourceAddr: Hex
  inbox: Hex
  proves: ProveIntentData[]
}

export type ExecuteWithdrawsJobData = {
  chainId: number
  intentSourceAddr: Hex
  intents: IntentType[]
}

// Specific job types
export type ExecuteSendBatchJobType = Job<
  Serialize<ExecuteSendBatchJobData>,
  unknown,
  IntentProcessorJobName.EXECUTE_SEND_BATCH
>

export type ExecuteWithdrawsJobType = Job<
  Serialize<ExecuteWithdrawsJobData>,
  unknown,
  IntentProcessorJobName.EXECUTE_WITHDRAWS
>

export type CheckWithdrawsCronJobType = Job<
  undefined,
  undefined,
  IntentProcessorJobName.CHECK_WITHDRAWS
>

export type CheckSendBatchJobType = Job<
  undefined, 
  undefined, 
  IntentProcessorJobName.CHECK_SEND_BATCH
>

// Union type of all intent processor jobs
export type IntentProcessorJobType =
  | ExecuteWithdrawsJobType
  | CheckWithdrawsCronJobType
  | CheckSendBatchJobType
  | ExecuteSendBatchJobType

// Alias for backwards compatibility
export type IntentProcessorJob = IntentProcessorJobType