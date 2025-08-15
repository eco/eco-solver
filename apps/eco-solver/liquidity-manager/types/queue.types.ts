import { Queue } from 'bullmq'
import { LiquidityManagerJobName } from '@/liquidity-manager/constants/job-names'

/**
 * Queue data and type definitions for liquidity manager
 */
export type LiquidityManagerQueueDataType = {
  /**
   * Correlation / tracking identifier that will propagate through every job handled by the
   * Liquidity Manager queue. Having this always present allows us to group logs that belong
   * to the same high-level operation or request.
   */
  id?: string
  [k: string]: unknown
}

export type LiquidityManagerQueueType = Queue<
  LiquidityManagerQueueDataType,
  unknown,
  LiquidityManagerJobName
>