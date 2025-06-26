import { QUEUES } from '@/common/redis/constants'
import { Hex } from 'viem'

/**
 * Job data interface for updating balance records from RPC
 * This job fetches current balances from blockchain RPC and updates balance records
 */
export interface UpdateBalanceRecordJobData {}

/**
 * Job data interface for updating balance
 */
export interface UpdateBalanceJobData {
  /** Chain ID */
  chainId: string
  /** Token address or 'native' */
  address: Hex | 'native'
  /** Change amount (positive for increment, negative for decrement) */
  changeAmount: string
  /** Direction of the change */
  direction: 'incoming' | 'outgoing'
  /** Block number */
  blockNumber: string
  /** Block hash */
  blockHash: string
  /** Transaction hash that caused the change */
  transactionHash: string
  /** Timestamp of the change */
  timestamp: Date
  /** From address */
  from?: string
  /** To address */
  to?: string
}

/**
 * Job names for balance tracking
 */
export const BALANCE_JOBS = QUEUES.BALANCE_MONITOR.jobs

/**
 * Job priorities for balance tracking
 */
export enum BalanceJobPriority {
  INITIALIZATION = 10,
  BALANCE_UPDATE = 8,
}

/**
 * Job options for balance tracking
 */
export const BALANCE_JOB_OPTIONS = {
  [BALANCE_JOBS.init_balance_record]: {
    jobId: 'init_balance_record',
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
    priority: BalanceJobPriority.INITIALIZATION,
    removeOnComplete: 1,
    removeOnFail: 3,
  },
  [BALANCE_JOBS.update_balance]: {
    jobId: 'update_balance',
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    priority: BalanceJobPriority.BALANCE_UPDATE,
    removeOnComplete: 5,
    removeOnFail: 3,
  },
}
