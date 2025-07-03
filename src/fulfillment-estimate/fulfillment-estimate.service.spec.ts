import { FulfillmentEstimateService } from './fulfillment-estimate.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Solver } from '@/eco-configs/eco-config.types'

// Mock EcoConfigService
const mockFulfillmentConfig = {
  executionPaddingSeconds: 3,
  blockTimePercentile: 0.5,
  defaultBlockTime: 15,
}

const mockEcoConfigService = {
  getFulfillmentEstimateConfig: jest.fn(() => mockFulfillmentConfig),
}

describe('FulfillmentEstimateService', () => {
  let service: FulfillmentEstimateService
  let loggerWarnSpy: jest.SpyInstance

  beforeEach(() => {
    service = new FulfillmentEstimateService(mockEcoConfigService as unknown as EcoConfigService)
    // Manually call onModuleInit to set up config
    service.onModuleInit()
    // Spy on logger
    loggerWarnSpy = jest.spyOn((service as any).logger, 'warn').mockImplementation(jest.fn())
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getAverageBlockTime', () => {
    it('returns solver.averageBlockTime if defined', () => {
      const solver: Partial<Solver> = { averageBlockTime: 10 }
      expect(service.getAverageBlockTime(solver as Solver)).toBe(10)
      expect(loggerWarnSpy).not.toHaveBeenCalled()
    })

    it('returns defaultBlockTime and logs warning if solver.averageBlockTime is undefined', () => {
      const solver: Partial<Solver> = {}
      expect(service.getAverageBlockTime(solver as Solver)).toBe(15)
      expect(loggerWarnSpy).toHaveBeenCalled()
    })

    it('returns defaultBlockTime and logs warning if solver is undefined', () => {
      expect(service.getAverageBlockTime(undefined)).toBe(15)
      expect(loggerWarnSpy).toHaveBeenCalled()
    })
  })

  describe('getEstimatedFulfillTime', () => {
    const baseQuoteIntent: any = {
      route: { destination: 1 },
      reward: {},
    }

    it('returns correct estimate when solver is found and has averageBlockTime', () => {
      const solver: Partial<Solver> = { averageBlockTime: 10, chainID: 1 }
      const getSolver = jest.fn().mockReturnValue(solver)
      service['ecoConfigService'].getSolver = getSolver
      // (10 * 0.5) + 3 = 5 + 3 = 8
      expect(service.getEstimatedFulfillTime(baseQuoteIntent)).toBe(8)
      expect(getSolver).toHaveBeenCalledWith(1)
    })

    it('returns correct estimate when solver is not found (undefined)', () => {
      const getSolver = jest.fn().mockReturnValue(undefined)
      service['ecoConfigService'].getSolver = getSolver
      // (15 * 0.5) + 3 = 7.5 + 3 = 10.5
      expect(service.getEstimatedFulfillTime(baseQuoteIntent)).toBe(10.5)
      expect(getSolver).toHaveBeenCalledWith(1)
    })

    it('returns correct estimate when solver has no averageBlockTime', () => {
      const solver: Partial<Solver> = { chainID: 1 }
      const getSolver = jest.fn().mockReturnValue(solver)
      service['ecoConfigService'].getSolver = getSolver
      // (15 * 0.5) + 3 = 7.5 + 3 = 10.5
      expect(service.getEstimatedFulfillTime(baseQuoteIntent)).toBe(10.5)
      expect(getSolver).toHaveBeenCalledWith(1)
    })

    it('handles fractional blockTimePercentile and executionPaddingSeconds', () => {
      // Override config for this test
      service['fulfillmentConfig'].blockTimePercentile = 0.33
      service['fulfillmentConfig'].executionPaddingSeconds = 2.7
      const solver: Partial<Solver> = { averageBlockTime: 9, chainID: 1 }
      const getSolver = jest.fn().mockReturnValue(solver)
      service['ecoConfigService'].getSolver = getSolver
      // (9 * 0.33) + 2.7 = 2.97 + 2.7 = 5.67
      expect(service.getEstimatedFulfillTime(baseQuoteIntent)).toBeCloseTo(5.67, 2)
      expect(getSolver).toHaveBeenCalledWith(1)
    })

    it('returns only executionPaddingSeconds if blockTimePercentile is 0', () => {
      service['fulfillmentConfig'].blockTimePercentile = 0
      service['fulfillmentConfig'].executionPaddingSeconds = 4
      const solver: Partial<Solver> = { averageBlockTime: 9, chainID: 1 }
      const getSolver = jest.fn().mockReturnValue(solver)
      service['ecoConfigService'].getSolver = getSolver
      // (9 * 0) + 4 = 0 + 4 = 4
      expect(service.getEstimatedFulfillTime(baseQuoteIntent)).toBe(4)
    })

    it('returns only averageBlockTime * blockTimePercentile if executionPaddingSeconds is 0', () => {
      service['fulfillmentConfig'].blockTimePercentile = 0.5
      service['fulfillmentConfig'].executionPaddingSeconds = 0
      const solver: Partial<Solver> = { averageBlockTime: 8, chainID: 1 }
      const getSolver = jest.fn().mockReturnValue(solver)
      service['ecoConfigService'].getSolver = getSolver
      // (8 * 0.5) + 0 = 4 + 0 = 4
      expect(service.getEstimatedFulfillTime(baseQuoteIntent)).toBe(4)
    })

    it('returns only executionPaddingSeconds if solver averageBlockTime is 0', () => {
      service['fulfillmentConfig'].blockTimePercentile = 0.5
      service['fulfillmentConfig'].executionPaddingSeconds = 7
      const solver: Partial<Solver> = { averageBlockTime: 0, chainID: 1 }
      const getSolver = jest.fn().mockReturnValue(solver)
      service['ecoConfigService'].getSolver = getSolver
      // (0 * 0.5) + 7 = 0 + 7 = 7
      expect(service.getEstimatedFulfillTime(baseQuoteIntent)).toBe(7)
    })
  })

  describe('onModuleInit', () => {
    let loggerErrorSpy: jest.SpyInstance

    beforeEach(() => {
      service = new FulfillmentEstimateService(mockEcoConfigService as unknown as EcoConfigService)
      loggerErrorSpy = jest.spyOn((service as any).logger, 'error').mockImplementation(jest.fn())
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('throws and logs if executionPaddingSeconds is missing', () => {
      mockEcoConfigService.getFulfillmentEstimateConfig.mockReturnValueOnce({
        blockTimePercentile: 0.5,
        defaultBlockTime: 15,
      } as any)
      expect(() => service.onModuleInit()).toThrow(
        'executionPaddingSeconds not found in fulfillmentEstimateConfig',
      )
      expect(loggerErrorSpy).toHaveBeenCalled()
    })

    it('throws and logs if blockTimePercentile is missing', () => {
      mockEcoConfigService.getFulfillmentEstimateConfig.mockReturnValueOnce({
        executionPaddingSeconds: 3,
        defaultBlockTime: 15,
      } as any)
      expect(() => service.onModuleInit()).toThrow(
        'blockTimePercentile not found in fulfillmentEstimateConfig',
      )
      expect(loggerErrorSpy).toHaveBeenCalled()
    })

    it('throws and logs if defaultBlockTime is missing', () => {
      mockEcoConfigService.getFulfillmentEstimateConfig.mockReturnValueOnce({
        executionPaddingSeconds: 3,
        blockTimePercentile: 0.5,
      } as any)
      expect(() => service.onModuleInit()).toThrow(
        'defaultBlockTime not found in fulfillmentEstimateConfig',
      )
      expect(loggerErrorSpy).toHaveBeenCalled()
    })

    it('sets fulfillmentConfig if all values are present', () => {
      mockEcoConfigService.getFulfillmentEstimateConfig.mockReturnValueOnce({
        executionPaddingSeconds: 3,
        blockTimePercentile: 0.5,
        defaultBlockTime: 15,
      })
      expect(() => service.onModuleInit()).not.toThrow()
      expect(service['fulfillmentConfig']).toEqual({
        executionPaddingSeconds: 3,
        blockTimePercentile: 0.5,
        defaultBlockTime: 15,
      })
    })
  })
})
