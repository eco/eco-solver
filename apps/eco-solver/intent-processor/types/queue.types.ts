import { Queue } from 'bullmq'
import { IntentProcessorJobName } from '@/intent-processor/constants/job-names'

/**
 * Queue data and type definitions for intent processor
 */
export type IntentProcessorQueueDataType = any

export type IntentProcessorQueueType = Queue<
  IntentProcessorQueueDataType,
  unknown,
  IntentProcessorJobName
>