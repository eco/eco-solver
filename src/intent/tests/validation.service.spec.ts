import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { ProofService } from '@/prover/proof.service'
import { ValidationService } from '@/intent/validation.sevice'
import { EcoConfigService } from '@/eco-configs/eco-config.service'

describe('ValidationService', () => {
  let validationService: ValidationService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let proofService: DeepMocked<ProofService>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogWarn = jest.fn()

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
        { provide: ProofService, useValue: createMock<ProofService>() },
      ],
    }).compile()

    validationService = mod.get(ValidationService)
    ecoConfigService = mod.get(EcoConfigService)
    utilsIntentService = mod.get(EcoConfigService)
    proofService = mod.get(EcoConfigService)

    validationService['logger'].debug = mockLogDebug
    validationService['logger'].log = mockLogLog
    validationService['logger'].warn = mockLogWarn
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
    mockLogWarn.mockClear()
  })


  describe('supportedProver', () => {
    it('should return false if the prover is not supported by the source intent', () => {
      // Arrange
      const model = { sourceChainID: BigInt(1), prover: '0x456' }
      ecoConfigService.getIntentSources.mockReturnValue([
        { chainID: '1', provers: ['0x123'] },
      ])

      // Act
      const result = validationService.supportedProver(model)

      // Assert
      expect(result).toBe(false)
    })

    it('should return true if the prover is supported by the source intent', () => {
      // Arrange
      const model = { sourceChainID: BigInt(1), prover: '0x123' }
      ecoConfigService.getIntentSources.mockReturnValue([
        { chainID: '1', provers: ['0x123'] },
      ])

      // Act
      const result = validationService.supportedProver(model)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('supportedSelectors', () => {
    it('should return false if route calls are empty', () => {
      // Arrange
      const model = { route: { calls: [] } }
      const solver = {}

      // Act
      const result = validationService.supportedSelectors(model, solver)

      // Assert
      expect(result).toBe(false)
      expect(mockLogLog).toHaveBeenCalledWith(expect.objectContaining({
        message: 'supportedSelectors: Target/data invalid',
      }))
    })

    it('should return true if all calls can be decoded', () => {
      // Arrange
      const model = { route: { calls: [{}, {}] } }
      const solver = {}
      utilsIntentService.getTransactionTargetData.mockReturnValue(true)

      // Act
      const result = validationService.supportedSelectors(model, solver)

      // Assert
      expect(result).toBe(true)
    })
  })

  describe('supportedTargets', () => {
    it('should return true if all targets are supported by the solver', () => {
      // Arrange
      const model = { route: { calls: [{ target: '0x1' }, { target: '0x2' }] } }
      const solver = { targets: { '0x1': {}, '0x2': {} } }

      // Act
      const result = validationService.supportedTargets(model, solver)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if any target is not supported by the solver', () => {
      // Arrange
      const model = { route: { calls: [{ target: '0x1' }, { target: '0x3' }] } }
      const solver = { targets: { '0x1': {}, '0x2': {} } }

      // Act
      const result = validationService.supportedTargets(model, solver)

      // Assert
      expect(result).toBe(false)
      expect(mockLogDebug).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Targets not supported for intent quote',
      }))
    })
  })

  describe('validExpirationTime', () => {
    it('should return true if the expiration time is within the proof minimum date', () => {
      // Arrange
      const model = { reward: { deadline: BigInt(Date.now() / 1000 + 1000), prover: '0x123' } }
      proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValue(true)

      // Act
      const result = validationService.validExpirationTime(model)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if the expiration time is not within the proof minimum date', () => {
      // Arrange
      const model = { reward: { deadline: BigInt(Date.now() / 1000 - 1000), prover: '0x123' } }
      proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValue(false)

      // Act
      const result = validationService.validExpirationTime(model)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('validDestination', () => {
    it('should return true if the destination is supported by the solver', () => {
      // Arrange
      const model = { route: { destination: '0x1' } }
      ecoConfigService.getSupportedChains.mockReturnValue(['0x1', '0x2'])

      // Act
      const result = validationService.validDestination(model)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if the destination is not supported by the solver', () => {
      // Arrange
      const model = { route: { destination: '0x3' } }
      ecoConfigService.getSupportedChains.mockReturnValue(['0x1', '0x2'])

      // Act
      const result = validationService.validDestination(model)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('fulfillOnDifferentChain', () => {
    it('should return true if the destination is different from the source', () => {
      // Arrange
      const model = { route: { destination: '0x1', source: '0x2' } }

      // Act
      const result = validationService.fulfillOnDifferentChain(model)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false if the destination is the same as the source', () => {
      // Arrange
      const model = { route: { destination: '0x1', source: '0x1' } }

      // Act
      const result = validationService.fulfillOnDifferentChain(model)

      // Assert
      expect(result).toBe(false)
    })
  })
})
