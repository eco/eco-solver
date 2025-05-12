import { Solver } from '@/eco-configs/eco-config.types'
import { getEstimatedFulfillTimeSec } from '../expected-execution'

interface TestSolver extends Pick<Solver, 'chainID'> {
  averageBlockTime: number
}

describe('getEstimatedFulfillTimeSec', () => {
  const mockSolver12s: TestSolver = { chainID: 1, averageBlockTime: 12 }
  const mockSolver2s: TestSolver = { chainID: 10, averageBlockTime: 2 }
  const mockSolver0s: TestSolver = { chainID: 99, averageBlockTime: 0 }
  const mockUndefinedSolver: undefined = undefined

  it('should return (avgBlockTime * block time percentile) + padding for standard calculation', () => {
    const padding = 3
    const blockTimePercentile = 0.5
    const expectedTime = getEstimatedFulfillTimeSec(
      mockSolver12s as Solver,
      padding,
      blockTimePercentile,
    )

    expect(expectedTime).toBe(9) // (12 * 0.5) + 3 = 6 + 3 = 9
  })

  it('should return correct time for chain with different block time', () => {
    const padding = 3
    const blockTimePercentile = 0.5
    const expectedTime = getEstimatedFulfillTimeSec(
      mockSolver2s as Solver,
      padding,
      blockTimePercentile,
    )
    expect(expectedTime).toBe(4) // (2 * 0.5) + 3 = 1 + 3 = 4
  })

  it('should return only (avgBlockTime * block time percentile) when padding is zero', () => {
    const padding = 0
    const blockTimePercentile = 0.5
    const expectedTime = getEstimatedFulfillTimeSec(
      mockSolver12s as Solver,
      padding,
      blockTimePercentile,
    )
    expect(expectedTime).toBe(6) // (12 * 0.5) + 0 = 6
  })

  it('should return only padding when block time is zero', () => {
    const padding = 3
    const blockTimePercentile = 0.5
    const expectedTime = getEstimatedFulfillTimeSec(
      mockSolver0s as Solver,
      padding,
      blockTimePercentile,
    )
    expect(expectedTime).toBe(3) // (0 / 2) + 3 = 3
  })

  it('should return (default avg time * block time percentile) + padding when solver is undefined', () => {
    const padding = 3
    const blockTimePercentile = 0.5
    // The helper getAverageBlockTimeSeconds defaults to 15 if solver is undefined
    const expectedTime = getEstimatedFulfillTimeSec(
      mockUndefinedSolver,
      padding,
      blockTimePercentile,
    )
    expect(expectedTime).toBe(10.5) // (15 * 0.5) + 3 = 7.5 + 3 = 10.5
  })

  it('should return (solver avg time * block time percentile) + padding even if padding is fractional', () => {
    const padding = 2.5
    const blockTimePercentile = 0.5
    const expectedTime = getEstimatedFulfillTimeSec(
      mockSolver12s as Solver,
      padding,
      blockTimePercentile,
    )
    expect(expectedTime).toBe(8.5) // (12 * 0.5) + 2.5 = 6 + 2.5 = 8.5
  })
  it('should return default block time * block time percentile + padding when solver is undefined', () => {
    const padding = 2.5
    const blockTimePercentile = 0.5
    const expectedTime = getEstimatedFulfillTimeSec(
      mockUndefinedSolver,
      padding,
      blockTimePercentile,
    )
    expect(expectedTime).toBe(10) // (15 * 0.5) + 2.5 = 7.5 + 2.5 = 10
  })
})
