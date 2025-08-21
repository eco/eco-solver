import { getStaticSolverConfig } from './solver-config'

describe('solverConfig', () => {
  it('should load static config', () => {
    const config = getStaticSolverConfig()
    expect(config).toBeDefined()
    expect(config).toHaveProperty('cache')
  })
})
