import { Solver } from '@/eco-configs/eco-config.types'

const DEFAULT_BLOCK_TIME = 15 // Default block time in seconds for unknown chains

/**
 * Returns the average block time for the given chainID. Falls back to DEFAULT_BLOCK_TIME seconds if the chainID
 * is unknown.
 */
export function getAverageBlockTimeSeconds(solver: Solver | undefined): number {
  if (!solver) {
    return DEFAULT_BLOCK_TIME
  }
  return solver.averageBlockTime ?? DEFAULT_BLOCK_TIME
}

/**
 * Simple heuristic for estimated fulfill time: average block time * block time percentile + network-propagation padding.
 */
export function getEstimatedFulfillTimeSec(
  solver: Solver | undefined,
  paddingSeconds: number,
  blockTimePercentile: number,
): number {
  return getAverageBlockTimeSeconds(solver) * blockTimePercentile + paddingSeconds
}
