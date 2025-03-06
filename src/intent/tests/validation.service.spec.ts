const mockGetTransactionTargetData = jest.fn()
import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { TransactionTargetData, UtilsIntentService } from '@/intent/utils-intent.service'
import { ProofService } from '@/prover/proof.service'
import {
  ValidationChecks,
  ValidationService,
  validationsSucceeded,
} from '@/intent/validation.sevice'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { entries } from 'lodash'
import { FeeService } from '@/fee/fee.service'
jest.mock('@/intent/utils', () => {
  return {
    ...jest.requireActual('@/intent/utils'),
    getTransactionTargetData: mockGetTransactionTargetData,
  }
})
describe('ValidationService', () => {
  let validationService: ValidationService
  let proofService: DeepMocked<ProofService>
  let feeService: DeepMocked<FeeService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  const mockLogLog = jest.fn()

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        { provide: ProofService, useValue: createMock<ProofService>() },
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
      ],
    }).compile()

    validationService = mod.get(ValidationService)
    proofService = mod.get(ProofService)
    feeService = mod.get(FeeService)
    ecoConfigService = mod.get(EcoConfigService)
    utilsIntentService = mod.get(UtilsIntentService)

    validationService['logger'].log = mockLogLog

    jest.spyOn(ecoConfigService, 'getIntentConfigs').mockReturnValueOnce({} as any)
    validationService.onModuleInit()
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    mockLogLog.mockClear()
  })

  describe('on validationsSucceeded', () => {
    it('should return false if any validations are false', async () => {
      const validations = {
        supportedProver: true,
        supportedTargets: true,
        supportedSelectors: true,
        validTransferLimit: true,
        validExpirationTime: false,
        validDestination: true,
        fulfillOnDifferentChain: true,
      } as ValidationChecks
      expect(validationsSucceeded(validations)).toBe(false)
    })

    it('should return false if all validations are false', async () => {
      const validations = {
        supportedProver: false,
        supportedTargets: false,
        supportedSelectors: false,
        validTransferLimit: false,
        validExpirationTime: false,
        validDestination: false,
        fulfillOnDifferentChain: false,
      } as ValidationChecks
      expect(validationsSucceeded(validations)).toBe(false)
    })

    it('should return true if all validations are true', async () => {
      const validations = {
        supportedProver: true,
        supportedTargets: true,
        supportedSelectors: true,
        validExpirationTime: true,
        validDestination: true,
        fulfillOnDifferentChain: true,
      } as ValidationChecks
      expect(validationsSucceeded(validations)).toBe(true)
    })
  })

  describe('on individual validation cases', () => {
    describe('on supportedProver', () => {
      const sourceChainID = 1n
      const chainID = sourceChainID
      const prover = '0xcf25397DC87C750eEF006101172FFbeAeA98Aa76'
      const unsupportedChain = 2n
      const unsupportedProver = '0x26D2C47c5659aC8a1c4A29A052Fa7B2ccD45Ca43'
      it('should fail if no source intent exists with the models source chain id', async () => {
        const intent = { event: { sourceChainID } } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([])
        expect(validationService.supportedProver(intent)).toBe(false)
      })

      it('should fail if no source supports the prover', async () => {
        const intent = { event: { sourceChainID }, intent: { reward: { prover } } } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [unsupportedProver], chainID } as any,
        ])
        expect(validationService.supportedProver(intent)).toBe(false)
      })

      it('should fail if no source supports the prover on the required chain', async () => {
        const intent = { event: { sourceChainID }, intent: { prover } } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [prover], chainID: unsupportedChain } as any,
        ])
        expect(validationService.supportedProver(intent)).toBe(false)
      })

      it('should succeed if a single source supports the prover', async () => {
        const intent = { sourceChainID, prover } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [unsupportedProver], chainID } as any,
          { provers: [prover], chainID } as any,
        ])
        expect(validationService.supportedProver(intent)).toBe(true)
      })

      it('should succeed if multiple sources supports the prover', async () => {
        const intent = { sourceChainID, prover } as any
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [prover], chainID } as any,
          { provers: [prover], chainID } as any,
        ])
        expect(validationService.supportedProver(intent)).toBe(true)
      })
    })

    describe('on supportedTargets', () => {
      const intent = { route: { calls: [] } } as any
      const solver = { targets: {} } as any
      it('should fail solver has no targets', async () => {
        intent.route.calls = []
        expect(validationService.supportedTargets(intent, solver)).toBe(false)
      })

      it('should fail intent has no targets', async () => {
        intent.route.calls = [{ target: '0x1' }]
        solver.targets = {}
        expect(validationService.supportedTargets(intent, solver)).toBe(false)
      })

      it('should fail not all targets are supported on solver', async () => {
        intent.route.calls = [{ target: '0x1' }, { target: '0x2' }]
        solver.targets = { [intent.route.calls[0].target]: {} }
        expect(validationService.supportedTargets(intent, solver)).toBe(false)
      })

      it('should succeed if targets supported ', async () => {
        intent.route.calls = [{ target: '0x1' }, { target: '0x2' }]
        solver.targets = { [intent.route.calls[0].target]: {}, [intent.route.calls[1].target]: {} }
        expect(validationService.supportedTargets(intent, solver)).toBe(true)
      })
    })

    describe('on supportedSelectors', () => {
      const intent = { route: { calls: [] } } as any
      const solver = { targets: {} } as any
      it('should fail if there are no calls', async () => {
        intent.route.calls = []
        expect(validationService.supportedSelectors(intent, solver)).toBe(false)
        expect(mockLogLog).toHaveBeenCalledTimes(1)
        expect(mockLogLog).toHaveBeenCalledWith({ msg: 'supportedSelectors: Target/data invalid' })
      })

      it('should fail not every call is supported', async () => {
        intent.route.calls = [{ target: '0x1' }, { target: '0x2' }]
        mockGetTransactionTargetData.mockImplementation((solver, call) => {
          return call.target == intent.route.calls[0].target
            ? ({} as any as TransactionTargetData)
            : null
        })
        expect(validationService.supportedSelectors(intent, solver)).toBe(false)
      })

      it('should succeed if every call is supported', async () => {
        intent.route.calls = [{ target: '0x1' }, { target: '0x2' }]
        mockGetTransactionTargetData.mockReturnValue({} as any as TransactionTargetData)
        expect(validationService.supportedSelectors(intent, solver)).toBe(true)
      })
    })

    describe('on validTransferLimit', () => {
      it('should return false if feeService does', async () => {
        const error = new Error('error here')
        jest
          .spyOn(feeService, 'getTotalFill')
          .mockResolvedValueOnce({ totalFillNormalized: 1n, error })
        expect(await validationService.validTransferLimit({} as any)).toBe(false)
      })

      it('should return false if the total fill above the max fill', async () => {
        //check default max fill
        jest
          .spyOn(feeService, 'getTotalFill')
          .mockResolvedValueOnce({ totalFillNormalized: ValidationService.DEFAULT_MAX_FILL + 1n })
        expect(await validationService.validTransferLimit({} as any)).toBe(false)
        //check setting from configs
        const max = 1000n
        jest
          .spyOn(ecoConfigService, 'getIntentConfigs')
          .mockReturnValueOnce({ maxFill: max } as any)
        validationService.onModuleInit()
        jest
          .spyOn(feeService, 'getTotalFill')
          .mockResolvedValueOnce({ totalFillNormalized: max + 1n })
        expect(await validationService.validTransferLimit({} as any)).toBe(false)
      })

      it('should return true if no error and the total fill is below max fill', async () => {
        const max = 1000n
        jest
          .spyOn(ecoConfigService, 'getIntentConfigs')
          .mockReturnValueOnce({ maxFill: max } as any)
        validationService.onModuleInit()
        jest
          .spyOn(feeService, 'getTotalFill')
          .mockResolvedValueOnce({ totalFillNormalized: max - 1n })
        expect(await validationService.validTransferLimit({} as any)).toBe(true)
      })
    })
    describe('on validExpirationTime', () => {
      //mostly covered in utilsIntentService
      it('should return whatever UtilsIntentService does', async () => {
        const intent = { reward: { deadline: 100 } } as any
        proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValueOnce(true)
        expect(validationService['validExpirationTime'](intent)).toBe(true)
        proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValueOnce(false)
        expect(validationService['validExpirationTime'](intent)).toBe(false)
      })
    })

    describe('on validDestination', () => {
      it('should fail if destination is not supported', async () => {
        const intent = { route: { destination: 10n } } as any
        ecoConfigService.getSupportedChains.mockReturnValueOnce([11n, 12n])
        expect(validationService['validDestination'](intent)).toBe(false)
      })

      it('should fail if destination is not supported', async () => {
        const intent = { route: { destination: 10n } } as any
        ecoConfigService.getSupportedChains.mockReturnValueOnce([10n, 12n])
        expect(validationService['validDestination'](intent)).toBe(true)
      })
    })

    describe('on fulfillOnDifferentChain', () => {
      it('should fail if the fulfillment is on the same chain as the event', async () => {
        const intent = {
          route: { destination: 10, source: 10 },
        } as any
        expect(validationService['fulfillOnDifferentChain'](intent)).toBe(false)
      })

      it('should succeed if the fulfillment is on a different chain as the event', async () => {
        const intent = {
          route: { destination: 10, source: 20 },
        } as any
        proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValueOnce(true)
        expect(validationService['fulfillOnDifferentChain'](intent)).toBe(true)
      })
    })
  })

  describe('on assertValidations', () => {
    const updateInvalidIntentModel = jest.fn()
    const assetCases: Record<keyof ValidationChecks, string> = {
      supportedProver: 'supportedProver',
      supportedTargets: 'supportedTargets',
      supportedSelectors: 'supportedSelectors',
      validTransferLimit: 'validTransferLimit',
      validExpirationTime: 'validExpirationTime',
      validDestination: 'validDestination',
      fulfillOnDifferentChain: 'fulfillOnDifferentChain',
    }
    beforeEach(() => {
      utilsIntentService.updateInvalidIntentModel = updateInvalidIntentModel
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    entries(assetCases).forEach(([fun, boolVarName]: [string, string]) => {
      it(`should fail on ${fun}`, async () => {
        const intent = {
          reward: {
            creator: '0xa',
            prover: '0xb',
            deadline: 100,
            tokens: [
              { token: '0x1', amount: 1n },
              { token: '0x2', amount: 2n },
            ],
          },
          route: {
            salt: '0x1',
            destination: 10,
            source: 11,
            calls: [],
          },
        } as any
        const solver = { targets: {} } as any
        const logObj = entries(assetCases).reduce(
          (ac, [, a]) => ({ ...ac, [a]: a == boolVarName }),
          {},
        )
        if (boolVarName == 'fulfillOnDifferentChain') {
          intent.route.destination = intent.route.source
        }
        const now = new Date()
        proofService.getProofMinimumDate = jest.fn().mockReturnValueOnce(now)
        validationService[fun] = jest.fn().mockReturnValueOnce(false)
        const validations = await validationService['assertValidations'](intent, solver)
        expect(validations[boolVarName]).toBe(false)
      })
    })
  })
})
