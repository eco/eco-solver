const mockgetChainConfig = jest.fn()
import { DeepMocked, createMock } from '@golevelup/ts-jest'
import { Test, TestingModule } from '@nestjs/testing'
import { EcoConfigService } from '../eco-config.service'
import { AwsConfigService } from '../aws-config.service'

jest.mock('../utils', () => {
  return {
    ...jest.requireActual('../utils'),
    getChainConfig: mockgetChainConfig,
  }
})

describe('Eco Config Helper Tests', () => {
  let ecoConfigService: EcoConfigService
  let awsConfigService: DeepMocked<AwsConfigService>
  let mockLog: jest.Mock
  const awsConfig = { aws: { faceAws: 'asdf', region: 'not-a-region' } }
  beforeEach(async () => {
    awsConfigService = createMock<AwsConfigService>()
    awsConfigService.getConfig = jest.fn().mockReturnValue(awsConfig)
    const configMod: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: EcoConfigService,
          useFactory: async (awsConfigService: AwsConfigService) => {
            await awsConfigService.initConfigs()
            return new EcoConfigService([awsConfigService])
          },
          inject: [AwsConfigService],
        },
        { provide: AwsConfigService, useValue: awsConfigService },
      ],
    }).compile()

    ecoConfigService = configMod.get<EcoConfigService>(EcoConfigService)
    mockLog = jest.fn()
  })

  it('should merge configs correctly', async () => {
    const oldConfig = ecoConfigService.get('aws') as any
    expect(ecoConfigService.get('aws')).toEqual({
      ...awsConfig.aws,
      ...oldConfig,
    })
  })

  describe('on getIntentSources', () => {
    const mockIS = {
      chainID: 1,
      tokens: ['0x12346817e7F6210A5b320F1A0bC96FfCf713A9b9'],
    }
    const mockChainConfig = {
      IntentSource: 'source',
      Prover: 'prover',
      HyperProver: 'hyperprover',
    }

    beforeEach(() => {
      jest.spyOn(ecoConfigService, 'get').mockReturnValue([mockIS])
    })

    it('should throw if not a correct address', () => {
      ecoConfigService.get = jest.fn().mockReturnValue([
        {
          chainID: 1,
          tokens: ['not-an-address'],
        },
      ])
      expect(() => ecoConfigService.getIntentSources()).toThrow()
    })

    it("should throw if chain config doesn't have a chain for that source", () => {
      mockgetChainConfig.mockReturnValue(undefined)
      expect(() => ecoConfigService.getIntentSources()).toThrow()
      expect(mockgetChainConfig).toHaveBeenCalled()
    })

    it('should return the intent sources', () => {
      mockgetChainConfig.mockReturnValue(mockChainConfig)
      ecoConfigService.get = jest.fn().mockReturnValue([mockIS])
      const result = ecoConfigService.getIntentSources()
      expect(result).toEqual([
        {
          ...mockIS,
          sourceAddress: mockChainConfig.IntentSource,
          provers: [mockChainConfig.HyperProver], // removed per audit warn =>  , mockChainConfig.Prover
        },
      ])
      expect(mockgetChainConfig).toHaveBeenCalled()
      expect(mockgetChainConfig).toHaveBeenCalledWith(mockIS.chainID)
    })
  })

  describe('on getSolvers', () => {
    const mockSolver = {
      chainID: 1,
      targets: {
        '0x12346817e7F6210A5b320F1A0bC96FfCf713A9b9': '0x12346817e7F6210A5b320F1A0bC96FfCf713A9b9',
      },
    }
    const mockChainConfig = {
      Inbox: 'inbox',
    }

    beforeEach(() => {
      jest.spyOn(ecoConfigService, 'get').mockReturnValue({ 1: mockSolver })
    })

    it('should throw if not a correct address', () => {
      mockgetChainConfig.mockReturnValue(mockChainConfig)
      ecoConfigService.get = jest.fn().mockReturnValue([
        {
          ...mockSolver,
          targets: { adf: 'not-an-address' },
        },
      ])
      expect(() => ecoConfigService.getSolvers()).toThrow()
    })

    it("should throw if chain config doesn't have a chain for that solver", () => {
      mockgetChainConfig.mockReturnValue(undefined)
      expect(() => ecoConfigService.getSolvers()).toThrow()
      expect(mockgetChainConfig).toHaveBeenCalled()
    })

    it('should return the solvers', () => {
      mockgetChainConfig.mockReturnValue(mockChainConfig)
      ecoConfigService.get = jest.fn().mockReturnValue([mockSolver])
      const result = ecoConfigService.getSolvers()
      expect(result).toEqual([{ ...mockSolver, inboxAddress: mockChainConfig.Inbox }])
      expect(mockgetChainConfig).toHaveBeenCalled()
      expect(mockgetChainConfig).toHaveBeenCalledWith(mockSolver.chainID)
    })
  })
})
