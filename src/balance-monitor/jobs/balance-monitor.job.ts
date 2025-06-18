import { QUEUES } from '@/common/redis/constants'
import { Hex } from 'viem'

/**
 * Job data interface for balance tracker initialization
 */
export interface InitializeTrackingJobData {
  /** Whether to force reinitialization */
  force?: boolean
}

/**
 * Job data interface for storing balance
 */
export interface StoreBalanceJobData {
  /** Chain ID */
  chainId: number
  /** Token address or 'native' */
  tokenAddress: string
  /** Current balance */
  balance: string
  /** Last updated timestamp */
  lastUpdated: string
  /** Token decimals (for ERC20 tokens) */
  decimals?: number
}

/**
 * Job data interface for updating balance
 */
export interface UpdateBalanceJobData {
  /** Chain ID */
  chainId: number
  /** Token address or 'native' */
  tokenAddress: string
  /** Change amount (positive for increment, negative for decrement) */
  changeAmount: string
  /** Transaction hash that caused the change */
  transactionHash?: Hex
  /** Timestamp of the change */
  timestamp?: string
}

/**
 * Job names for balance tracking
 */
export const BALANCE_MONITOR_JOBS = QUEUES.BALANCE_MONITOR.jobs

/**
 * Job priorities for balance tracking
 */
export enum BalanceTrackerJobPriority {
  INITIALIZATION = 10,
  BALANCE_UPDATE = 8,
}

/**
 * Job options for balance tracking
 */
export const BALANCE_TRACKER_JOB_OPTIONS = {
  [BALANCE_MONITOR_JOBS.initialize_monitoring]: {
    jobId: 'initialize_monitoring',
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    priority: BalanceTrackerJobPriority.INITIALIZATION,
    removeOnComplete: 1,
    removeOnFail: 3,
  },
  [BALANCE_MONITOR_JOBS.update_balance]: {
    jobId: 'update_balance',
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    priority: BalanceTrackerJobPriority.BALANCE_UPDATE,
    removeOnComplete: 5,
    removeOnFail: 3,
  },
}
