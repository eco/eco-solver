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
import { FeeConfigType } from '@/eco-configs/eco-config.types'
import { BalanceService } from '@/balance/balance.service'
import { BASE_DECIMALS } from '@/intent/utils'
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
  let balanceService: DeepMocked<BalanceService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  const mockLogLog = jest.fn()

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        { provide: ProofService, useValue: createMock<ProofService>() },
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
      ],
    }).compile()

    validationService = mod.get(ValidationService)
    proofService = mod.get(ProofService)
    feeService = mod.get(FeeService)
    balanceService = mod.get(BalanceService)
    ecoConfigService = mod.get(EcoConfigService)
    utilsIntentService = mod.get(UtilsIntentService)

    // Mock Logger to avoid console output during tests
    validationService['logger'].log = mockLogLog
    validationService['logger'].error = jest.fn()
    validationService['logger'].warn = jest.fn()
    validationService['logger'].debug = jest.fn()

    // Mock default config values to prevent initialization errors
    ecoConfigService.getIntentConfigs.mockReturnValue({ isNativeETHSupported: true } as any)
    ecoConfigService.getEth.mockReturnValue({
      simpleAccount: { minEthBalanceWei: '0' },
    } as any)

    // Mock default solver to prevent null reference errors
    const defaultMockSolver = {
      inboxAddress: '0x123',
      network: 'mainnet',
      fee: {},
      chainID: 10n,
      averageBlockTime: 12000,
      targets: {},
    } as any
    ecoConfigService.getSolver.mockReturnValue(defaultMockSolver)

    // Mock proofService methods to return a valid ProofType by default
    const mockProofType = {
      isHyperlane: () => true,
      isMetalayer: () => false,
    }
    proofService.getProverType.mockReturnValue(mockProofType as any)
    proofService.isIntentExpirationWithinProofMinimumDate.mockReturnValue(true)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    mockLogLog.mockClear()
  })

  describe('on initialization', () => {
    it('should set isNativeETHSupported based on config on module init', () => {
      // Test when native is supported
      ecoConfigService.getIntentConfigs.mockReturnValue({ isNativeETHSupported: true } as any)
      validationService.onModuleInit()
      expect(validationService['isNativeETHSupported']).toBe(true)

      // Test when native is not supported
      ecoConfigService.getIntentConfigs.mockReturnValue({ isNativeETHSupported: false } as any)
      validationService.onModuleInit()
      expect(validationService['isNativeETHSupported']).toBe(false)
    })

    it('should set minEthBalanceWei from config on module init', () => {
      const mockMinEthBalance = '500000000000000000' // 0.5 ETH in wei as string
      ecoConfigService.getEth.mockReturnValue({
        simpleAccount: { minEthBalanceWei: mockMinEthBalance },
      } as any)
      ecoConfigService.getIntentConfigs.mockReturnValue({ isNativeETHSupported: true } as any)

      validationService.onModuleInit()

      expect(validationService['minEthBalanceWei']).toBe(BigInt(mockMinEthBalance))
      expect(ecoConfigService.getEth).toHaveBeenCalled()
    })

    it('should handle zero minimum ETH balance configuration', () => {
      ecoConfigService.getEth.mockReturnValue({
        simpleAccount: { minEthBalanceWei: '0' },
      } as any)
      ecoConfigService.getIntentConfigs.mockReturnValue({ isNativeETHSupported: true } as any)

      validationService.onModuleInit()

      expect(validationService['minEthBalanceWei']).toBe(0n)
    })

    it('should handle large minimum ETH balance values', () => {
      const largeMinBalance = '10000000000000000000' // 10 ETH in wei
      ecoConfigService.getEth.mockReturnValue({
        simpleAccount: { minEthBalanceWei: largeMinBalance },
      } as any)
      ecoConfigService.getIntentConfigs.mockReturnValue({ isNativeETHSupported: true } as any)

      validationService.onModuleInit()

      expect(validationService['minEthBalanceWei']).toBe(BigInt(largeMinBalance))
    })
  })

  describe('on validationsSucceeded', () => {
    it('should return false if any validations are false', async () => {
      const validations: ValidationChecks = {
        supportedProver: true,
        supportedNative: true,
        supportedTargets: true,
        supportedTransaction: true,
        validTransferLimit: true,
        validExpirationTime: false,
        validDestination: true,
        fulfillOnDifferentChain: true,
        sufficientBalance: true,
      }
      expect(validationsSucceeded(validations)).toBe(false)
    })

    it('should return false if all validations are false', async () => {
      const validations: ValidationChecks = {
        supportedProver: false,
        supportedNative: false,
        supportedTargets: false,
        supportedTransaction: false,
        validTransferLimit: false,
        validExpirationTime: false,
        validDestination: false,
        fulfillOnDifferentChain: false,
        sufficientBalance: false,
      }
      expect(validationsSucceeded(validations)).toBe(false)
    })

    it('should return true if all validations are true', async () => {
      const validations: ValidationChecks = {
        supportedProver: true,
        supportedNative: true,
        supportedTargets: true,
        supportedTransaction: true,
        validTransferLimit: true,
        validExpirationTime: true,
        validDestination: true,
        fulfillOnDifferentChain: true,
        sufficientBalance: true,
      }
      expect(validationsSucceeded(validations)).toBe(true)
    })
  })

  describe('on individual validation cases', () => {
    describe('on supportedProver', () => {
      const sourceChainID = 1n
      const chainID = 1
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
        // Mock the first call for source chain check
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [unsupportedProver], chainID } as any,
          { provers: [prover], chainID } as any,
        ])
        // Mock the second call for destination chain check
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [prover], chainID } as any,
        ])
        expect(
          validationService.supportedProver({
            source: Number(sourceChainID),
            destination: Number(chainID),
            prover: prover as any,
          }),
        ).toBe(true)
      })

      it('should succeed if multiple sources supports the prover', async () => {
        // Mock the first call for source chain check
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [prover], chainID } as any,
          { provers: [prover], chainID } as any,
        ])
        // Mock the second call for destination chain check
        ecoConfigService.getIntentSources.mockReturnValueOnce([
          { provers: [prover], chainID } as any,
        ])
        expect(
          validationService.supportedProver({
            source: Number(sourceChainID),
            destination: Number(chainID),
            prover: prover as any,
          }),
        ).toBe(true)
      })
    })

    describe('on supportedNative', () => {
      let mockIsNativeIntent: jest.SpyInstance
      let mockEquivalentNativeGas: jest.SpyInstance
      let mockIsNativeETH: jest.SpyInstance

      beforeEach(() => {
        mockIsNativeIntent = jest.spyOn(require('@/intent/utils'), 'isNativeIntent')
        mockEquivalentNativeGas = jest.spyOn(require('@/intent/utils'), 'equivalentNativeGas')
        mockIsNativeETH = jest.spyOn(require('@/intent/utils'), 'isNativeETH')
      })

      afterEach(() => {
        mockIsNativeIntent.mockRestore()
        mockEquivalentNativeGas.mockRestore()
        mockIsNativeETH.mockRestore()
      })

      describe('when native is enabled', () => {
        beforeEach(() => {
          validationService['isNativeETHSupported'] = true
        })

        it('should return true when intent is not native', () => {
          const intent = { route: { calls: [] }, reward: { nativeValue: 0n } } as any
          mockIsNativeIntent.mockReturnValue(false)

          expect(validationService.supportedNative(intent)).toBe(true)
          expect(mockIsNativeIntent).toHaveBeenCalledWith(intent)
        })

        it('should return true if equivalentNativeGas and isNativeETH are true', () => {
          const intent = { route: { calls: [{ value: 100n }] }, reward: { nativeValue: 0n } } as any
          mockIsNativeIntent.mockReturnValue(true)
          mockEquivalentNativeGas.mockReturnValue(true)
          mockIsNativeETH.mockReturnValue(true)
          expect(validationService.supportedNative(intent)).toBe(true)
          expect(mockEquivalentNativeGas).toHaveBeenCalledWith(intent, validationService['logger'])
          expect(mockIsNativeETH).toHaveBeenCalledWith(intent)
        })

        it('should return false if equivalentNativeGas is true and isNativeETH is false', () => {
          const intent = { route: { calls: [{ value: 100n }] }, reward: { nativeValue: 0n } } as any
          mockIsNativeIntent.mockReturnValue(true)
          mockEquivalentNativeGas.mockReturnValue(true)
          mockIsNativeETH.mockReturnValue(false)

          expect(validationService.supportedNative(intent)).toBe(false)
          expect(mockEquivalentNativeGas).toHaveBeenCalledWith(intent, validationService['logger'])
          expect(mockIsNativeETH).toHaveBeenCalledWith(intent)
        })

        it('should return false when intent is native ETH but native ETH is not supported', () => {
          const intent = { route: { calls: [{ value: 100n }] }, reward: { nativeValue: 0n } } as any
          mockIsNativeIntent.mockReturnValue(true)
          mockEquivalentNativeGas.mockReturnValue(true)
          mockIsNativeETH.mockReturnValue(true)
          validationService['isNativeETHSupported'] = false

          expect(validationService.supportedNative(intent)).toBe(false)
        })
      })

      describe('when native is disabled', () => {
        beforeEach(() => {
          validationService['isNativeETHSupported'] = false
        })

        it('should return false when intent is native', () => {
          const intent = { route: { calls: [{ value: 100n }] }, reward: { nativeValue: 0n } } as any
          mockIsNativeIntent.mockReturnValue(true)

          expect(validationService.supportedNative(intent)).toBe(false)
          expect(mockIsNativeIntent).toHaveBeenCalledWith(intent)
        })

        it('should return true when intent is not native', () => {
          const intent = {
            route: { calls: [{ target: '0x1', data: '0x2', value: 0n }] },
            reward: { nativeValue: 0n },
          } as any
          mockIsNativeIntent.mockReturnValue(false)

          expect(validationService.supportedNative(intent)).toBe(true)
          expect(mockIsNativeIntent).toHaveBeenCalledWith(intent)
        })
      })
    })

    describe('on supportedTargets', () => {
      const intent = { route: { calls: [{ target: '0xa1', data: '0x', value: 10n }] } } as any
      const solver = { targets: {} } as any
      let mockGetFunctionTargets: jest.SpyInstance

      beforeEach(() => {
        mockGetFunctionTargets = jest.spyOn(require('@/intent/utils'), 'getFunctionTargets')
      })

      afterEach(() => {
        mockGetFunctionTargets.mockRestore()
      })

      it('should fail if intent has no targets', async () => {
        mockGetFunctionTargets.mockReturnValue([{ target: '0x1', data: '0x' }])
        solver.targets = {}
        expect(validationService.supportedTargets(intent, solver)).toBe(false)
      })

      it('should fail if not all targets are supported on solver', async () => {
        intent.route.calls = [
          { target: '0x1', data: '0x12', value: 0n },
          { target: '0x2', data: '0x3', value: 0n },
        ]
        solver.targets = { [intent.route.calls[0].target]: {} }
        expect(validationService.supportedTargets(intent, solver)).toBe(false)
      })

      it('should succeed if solver has no targets and there are no functional calls', async () => {
        let nativeIntent = { route: { calls: [{ target: '0xa1', data: '0x', value: 10n }] } } as any
        expect(validationService.supportedTargets(nativeIntent, solver)).toBe(true)
        expect(mockGetFunctionTargets).toHaveBeenCalledTimes(1)
      })

      it('should succeed if targets supported ', async () => {
        intent.route.calls = [
          { target: '0x1', data: '0x12', value: 0n },
          { target: '0x2', data: '0x34', value: 0n },
        ]
        solver.targets = { [intent.route.calls[0].target]: {}, [intent.route.calls[1].target]: {} }
        expect(validationService.supportedTargets(intent, solver)).toBe(true)
      })
    })

    describe('on supportedTransaction', () => {
      const intent = { route: { calls: [] } } as any
      const solver = { targets: {} } as any
      it('should fail if there are no calls', async () => {
        intent.route.calls = []
        expect(validationService.supportedTransaction(intent, solver)).toBe(false)
        expect(mockLogLog).toHaveBeenCalledTimes(1)
        expect(mockLogLog).toHaveBeenCalledWith({ msg: 'supportedSelectors: Target/data invalid' })
      })

      it('should fail if not every function call is supported', async () => {
        intent.route.calls = [
          { target: '0x1', data: '0x12', value: 0n },
          { target: '0x2', data: '0x34', value: 0n },
        ]
        mockGetTransactionTargetData.mockImplementation((solver, call) => {
          return call.target == intent.route.calls[0].target
            ? ({} as any as TransactionTargetData)
            : null
        })
        expect(validationService.supportedTransaction(intent, solver)).toBe(false)
      })

      it('should succeed if every call is supported', async () => {
        intent.route.calls = [
          { target: '0x1', data: '0x12', value: 0n },
          { target: '0x2', data: '0x34', value: 0n },
        ]
        mockGetTransactionTargetData.mockReturnValue({} as any as TransactionTargetData)
        expect(validationService.supportedTransaction(intent, solver)).toBe(true)
      })
    })

    describe('on validTransferLimit', () => {
      const defaultFee: FeeConfigType<'linear'> = {
        limit: {
          tokenLimit: 1000n * 10n ** 6n,
          nativeLimit: 1000n * 10n ** 18n,
        },
        algorithm: 'linear',
        constants: {
          token: {
            baseFee: 20_000n,
            tranche: {
              unitFee: 15_000n,
              unitSize: 100_000_000n,
            },
          },
          native: {
            baseFee: 6_000n,
            tranche: {
              unitFee: 5_000n,
              unitSize: 30_000_000n,
            },
          },
        },
      }
      it('should return false if feeService does', async () => {
        const error = new Error('error here')
        const intent = { hash: '0x123', route: { source: 11 } } as any
        jest
          .spyOn(feeService, 'getTotalFill')
          .mockResolvedValueOnce({ totalFillNormalized: { token: 1n, native: 2n }, error })
        expect(await validationService.validTransferLimit(intent)).toBe(false)
      })

      it('should return false if the total fill above the max fill', async () => {
        const mockFeeConfig = jest.fn().mockReturnValue(defaultFee)
        feeService.getFeeConfig = mockFeeConfig
        jest.spyOn(feeService, 'getTotalFill').mockResolvedValueOnce({
          totalFillNormalized: { token: defaultFee.limit.tokenLimit + 1n, native: 0n },
        })
        expect(await validationService.validTransferLimit({} as any)).toBe(false)
        expect(mockFeeConfig).toHaveBeenCalledTimes(1)

        jest.spyOn(feeService, 'getTotalFill').mockResolvedValueOnce({
          totalFillNormalized: { token: 0n, native: defaultFee.limit.nativeLimit + 1n },
        })
        expect(await validationService.validTransferLimit({} as any)).toBe(false)
        expect(mockFeeConfig).toHaveBeenCalledTimes(2)

        jest.spyOn(feeService, 'getTotalFill').mockResolvedValueOnce({
          totalFillNormalized: {
            token: defaultFee.limit.tokenLimit + 1n,
            native: defaultFee.limit.nativeLimit + 1n,
          },
        })
        expect(await validationService.validTransferLimit({} as any)).toBe(false)
        expect(mockFeeConfig).toHaveBeenCalledTimes(3)
      })

      it('should return true if no error and the total fill is below max fill', async () => {
        const mockFeeConfig = jest.fn().mockReturnValue(defaultFee)
        feeService.getFeeConfig = mockFeeConfig

        jest.spyOn(feeService, 'getTotalFill').mockResolvedValueOnce({
          totalFillNormalized: {
            token: defaultFee.limit.tokenLimit,
            native: defaultFee.limit.nativeLimit,
          },
        })
        expect(await validationService.validTransferLimit({} as any)).toBe(true)
        expect(mockFeeConfig).toHaveBeenCalledTimes(1)
      })
    })

    describe('on validExpirationTime', () => {
      //mostly covered in utilsIntentService
      it('should return whatever UtilsIntentService does', async () => {
        const intent = { reward: { deadline: 100, prover: '0x123' }, route: { source: 11 } } as any
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
        expect(validationService['fulfillOnDifferentChain'](intent)).toBe(true)
      })
    })

    describe('on hasSufficientBalance', () => {
      const mockIntent = {
        hash: '0x123',
        route: {
          destination: 10,
          tokens: [
            // Token amounts already normalized to 18 decimals by API interceptor
            { token: '0xToken1', amount: 1000000000000000000000n }, // 1000 tokens in 18 decimals
            { token: '0xToken2', amount: 2000000000000000000000n }, // 2000 tokens in 18 decimals
          ],
          calls: [
            { target: '0x1', data: '0x', value: 100n },
            { target: '0x2', data: '0x', value: 200n },
          ],
        },
      } as any

      it('should return false when solver doesnt exist', async () => {
        ecoConfigService.getSolver.mockReturnValue(undefined)
        balanceService.fetchTokenBalances.mockResolvedValue({
          '0xToken1': {
            address: '0xToken1',
            balance: 1500000000000000000000n, // 1500 tokens in 18 decimals (normalized)
            decimals: { original: 6, current: BASE_DECIMALS },
          },
          '0xToken2': {
            address: '0xToken2',
            balance: 2500000000000000000000n, // 2500 tokens in 18 decimals (normalized)
            decimals: { original: 6, current: BASE_DECIMALS },
          },
        })
        balanceService.getNativeBalance.mockResolvedValue(500n)

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(false)
      })

      it('should return false when solver has insufficient token balance', async () => {
        balanceService.fetchTokenBalances.mockResolvedValue({
          '0xToken1': {
            address: '0xToken1',
            balance: 500000000000000000000n, // 500 tokens in 18 decimals - insufficient for 1000 needed
            decimals: { original: 6, current: BASE_DECIMALS },
          },
          '0xToken2': {
            address: '0xToken2',
            balance: 2500000000000000000000n, // 2500 tokens in 18 decimals (sufficient)
            decimals: { original: 6, current: BASE_DECIMALS },
          },
        })
        balanceService.getNativeBalance.mockResolvedValue(500n)

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(false)
      })

      it('should return false when solver has insufficient native balance', async () => {
        balanceService.fetchTokenBalances.mockResolvedValue({
          '0xToken1': {
            address: '0xToken1',
            balance: 1500000000000000000000n, // 1500 tokens in 18 decimals (sufficient)
            decimals: { original: 6, current: BASE_DECIMALS },
          },
          '0xToken2': {
            address: '0xToken2',
            balance: 2500000000000000000000n, // 2500 tokens in 18 decimals (sufficient)
            decimals: { original: 6, current: BASE_DECIMALS },
          },
        })
        balanceService.getNativeBalance.mockResolvedValue(250n) // insufficient for 300n total

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(false)
      })

      it('should return false when token balance is missing', async () => {
        balanceService.fetchTokenBalances.mockResolvedValue({
          '0xToken1': {
            address: '0xToken1',
            balance: 1500n,
            decimals: { original: 6, current: BASE_DECIMALS },
          },
          // Missing '0xToken2'
        })
        balanceService.getNativeBalance.mockResolvedValue(500n)

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(false)
      })

      it('should return false when balance service throws an error', async () => {
        balanceService.fetchTokenBalances.mockRejectedValue(new Error('Network error'))

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(false)
      })

      describe('when solver exists', () => {
        beforeEach(() => {
          const mockSolver = {
            inboxAddress: '0x123',
            network: 'mainnet',
            fee: {},
            chainID: 10n,
            averageBlockTime: 12000,
            targets: {
              '0xToken1': { minBalance: 50000000000000000000n }, // 50 dollars converted: 50 * 10^6 * 10^12 = 50 * 10^18
              '0xToken2': { minBalance: 100000000000000000000n }, // 100 dollars converted: 100 * 10^6 * 10^12 = 100 * 10^18
            },
          } as any
          ecoConfigService.getSolver.mockReturnValue(mockSolver)
        })

        it('should return true when there are no native value calls', async () => {
          const intentWithoutNative = {
            ...mockIntent,
            route: {
              ...mockIntent.route,
              calls: [
                { target: '0x1', data: '0x', value: 0n },
                { target: '0x2', data: '0x', value: 0n },
              ],
            },
          }

          balanceService.fetchTokenBalances.mockResolvedValue({
            '0xToken1': {
              address: '0xToken1',
              balance: 1500000000000000000000n, // 1500 tokens in base 18 (sufficient for 1000 + 50 min)
              decimals: { original: 6, current: BASE_DECIMALS },
            },
            '0xToken2': {
              address: '0xToken2',
              balance: 2500000000000000000000n, // 2500 tokens in base 18 (sufficient for 2000 + 100 min)
              decimals: { original: 6, current: BASE_DECIMALS },
            },
          })

          const result = await validationService['hasSufficientBalance'](intentWithoutNative)
          expect(result).toBe(true)
          expect(balanceService.getNativeBalance).not.toHaveBeenCalled()
        })

        it('should handle calls without value property', async () => {
          const intentWithMixedCalls = {
            ...mockIntent,
            route: {
              ...mockIntent.route,
              calls: [
                { target: '0x1', data: '0x', value: 100n },
                { target: '0x2', data: '0x' }, // no value property
                { target: '0x3', data: '0x', value: 200n },
              ],
            },
          }

          balanceService.fetchTokenBalances.mockResolvedValue({
            '0xToken1': {
              address: '0xToken1',
              balance: 1500000000000000000000n, // 1500 tokens in base 18 (sufficient for 1000 + 50 min)
              decimals: { original: 6, current: BASE_DECIMALS },
            },
            '0xToken2': {
              address: '0xToken2',
              balance: 2500000000000000000000n, // 2500 tokens in base 18 (sufficient for 2000 + 100 min)
              decimals: { original: 6, current: BASE_DECIMALS },
            },
          })
          balanceService.getNativeBalance.mockResolvedValue(500n)

          const result = await validationService['hasSufficientBalance'](intentWithMixedCalls)
          expect(result).toBe(true)
          expect(balanceService.getNativeBalance).toHaveBeenCalledWith(10, 'kernel')
        })

        it('should return true when solver has sufficient token and native balances', async () => {
          balanceService.fetchTokenBalances.mockResolvedValue({
            '0xToken1': {
              address: '0xToken1',
              balance: 1500000000000000000000n, // 1500 tokens in base 18 (sufficient for 1000 + 50 min)
              decimals: { original: 6, current: BASE_DECIMALS },
            },
            '0xToken2': {
              address: '0xToken2',
              balance: 2500000000000000000000n, // 2500 tokens in base 18 (sufficient for 2000 + 100 min)
              decimals: { original: 6, current: BASE_DECIMALS },
            },
          })
          balanceService.getNativeBalance.mockResolvedValue(500n)

          const result = await validationService['hasSufficientBalance'](mockIntent)
          expect(result).toBe(true)
          expect(balanceService.fetchTokenBalances).toHaveBeenCalledWith(10, [
            '0xToken1',
            '0xToken2',
          ])
          expect(balanceService.getNativeBalance).toHaveBeenCalledWith(10, 'kernel')
        })

        it('should return true when solver has sufficient balances for tokens (amounts pre-normalized by API)', async () => {
          // Token amounts in mockIntent are already normalized to 18 decimals by the API layer interceptor
          balanceService.fetchTokenBalances.mockResolvedValue({
            '0xToken1': {
              address: '0xToken1',
              balance: 1_500_000_000_000_000_000_000n, // 1500 tokens in 18 decimals (normalized)
              decimals: { original: BASE_DECIMALS, current: BASE_DECIMALS },
            },
            '0xToken2': {
              address: '0xToken2',
              balance: 2_500_000_000_000_000_000_000n, // 2500 tokens in 18 decimals (normalized)
              decimals: { original: 6, current: BASE_DECIMALS },
            },
          })
          balanceService.getNativeBalance.mockResolvedValue(500n)

          const result = await validationService['hasSufficientBalance'](mockIntent)
          expect(result).toBe(true)
          expect(balanceService.fetchTokenBalances).toHaveBeenCalledWith(10, [
            '0xToken1',
            '0xToken2',
          ])
          expect(balanceService.getNativeBalance).toHaveBeenCalledWith(10, 'kernel')

          // No normalization calls should be made - amounts are already normalized by API interceptor
        })

        it('should correctly handle token minimum balance requirements with solver targets', async () => {
          const intentWithTokens = {
            ...mockIntent,
            route: {
              ...mockIntent.route,
              tokens: [
                // Token amounts are already normalized to 18 decimals by API interceptor
                { token: '0xToken1', amount: 1000000000000000000000n }, // 1000 tokens in 18 decimals
                { token: '0xToken2', amount: 500000000000000000000n }, // 500 tokens in 18 decimals
              ],
              calls: [], // no native calls
            },
          }

          balanceService.fetchTokenBalances.mockResolvedValue({
            // All balances are normalized to 18 decimals for comparison
            // Token1: balance 1100, minReq 50, available = 1100-50 = 1050, need 1000 ✓
            '0xToken1': {
              address: '0xToken1',
              balance: 1100000000000000000000n,
              decimals: { original: 6, current: BASE_DECIMALS },
            },
            // Token2: balance 550, minReq 100, available = 550-100 = 450, need 500 ✗
            '0xToken2': {
              address: '0xToken2',
              balance: 550000000000000000000n,
              decimals: { original: 6, current: BASE_DECIMALS },
            },
          })

          const result = await validationService['hasSufficientBalance'](intentWithTokens)
          expect(result).toBe(false) // Should fail because Token2 insufficient after min balance
        })

        it('should pass when solver has no specific minimum balance requirements for tokens', async () => {
          // Override solver mock to have no minimum balance requirements
          const mockSolverNoMinBalance = {
            inboxAddress: '0x123',
            network: 'mainnet',
            fee: {},
            chainID: 10n,
            averageBlockTime: 12000,
            targets: {}, // No minimum balance requirements
          } as any
          ecoConfigService.getSolver.mockReturnValue(mockSolverNoMinBalance)

          const intentWithTokens = {
            ...mockIntent,
            route: {
              ...mockIntent.route,
              tokens: [
                // Token amounts already normalized to 18 decimals by API interceptor
                { token: '0xToken1', amount: 1000000000000000000000n }, // 1000 tokens in 18 decimals
                { token: '0xToken2', amount: 500000000000000000000n }, // 500 tokens in 18 decimals
              ],
              calls: [],
            },
          }

          balanceService.fetchTokenBalances.mockResolvedValue({
            '0xToken1': {
              address: '0xToken1',
              balance: 1000000000000000000000n, // exactly enough (18 decimals)
              decimals: { original: 6, current: BASE_DECIMALS },
            },
            '0xToken2': {
              address: '0xToken2',
              balance: 500000000000000000000n, // exactly enough (18 decimals)
              decimals: { original: 6, current: BASE_DECIMALS },
            },
          })

          const result = await validationService['hasSufficientBalance'](intentWithTokens)
          expect(result).toBe(true)
        })

        it('should log warning when native balance is insufficient', async () => {
          const mockLogWarn = jest.fn()
          validationService['logger'].warn = mockLogWarn

          // Mock solver
          const mockSolver = {
            inboxAddress: '0x123',
            network: 'mainnet',
            fee: {},
            chainID: 10n,
            averageBlockTime: 12000,
            targets: {},
          } as any
          ecoConfigService.getSolver.mockReturnValue(mockSolver)

          const intentWithNativeValue = {
            hash: '0xTestHash',
            route: {
              destination: 10,
              tokens: [],
              calls: [{ target: '0x1', data: '0x', value: 100n }],
            },
          } as any

          balanceService.fetchTokenBalances.mockResolvedValue({})
          // Only 50n available, but need 100n
          balanceService.getNativeBalance.mockResolvedValue(50n)

          const result = await validationService['hasSufficientBalance'](intentWithNativeValue)

          expect(result).toBe(false)
          expect(mockLogWarn).toHaveBeenCalledWith(
            expect.objectContaining({
              msg: 'hasSufficientBalance: Insufficient native balance',
              required: '100',
              available: '50',
              intentHash: '0xTestHash',
              destination: 10,
            }),
          )
        })

        it('should log warning when token balance is insufficient after minimum balance check', async () => {
          const mockLogWarn = jest.fn()
          validationService['logger'].warn = mockLogWarn

          const mockSolver = {
            inboxAddress: '0x123',
            network: 'mainnet',
            fee: {},
            chainID: 10n,
            averageBlockTime: 12000,
            targets: {
              '0xToken1': { minBalance: 100000000000000000000n }, // 100 dollars converted: 100 * 10^6 * 10^12 = 100 * 10^18
            },
          } as any
          ecoConfigService.getSolver.mockReturnValue(mockSolver)

          const intentWithTokens = {
            hash: '0xTestHash',
            route: {
              destination: 10,
              tokens: [{ token: '0xToken1', amount: 1000n }],
              calls: [],
            },
          } as any

          balanceService.fetchTokenBalances.mockResolvedValue({
            '0xToken1': {
              address: '0xToken1',
              balance: 500n,
              decimals: { original: 6, current: BASE_DECIMALS },
            },
          })

          const result = await validationService['hasSufficientBalance'](intentWithTokens)

          expect(result).toBe(false)
          expect(mockLogWarn).toHaveBeenCalledWith(
            expect.objectContaining({
              msg: 'hasSufficientBalance: Insufficient token balance',
              token: '0xToken1',
              required: '1000',
              available: '500',
              intentHash: '0xTestHash',
              destination: 10,
            }),
          )
        })

        it('should return false and log warning when no solver found for destination chain', async () => {
          const mockLogWarn = jest.fn()
          validationService['logger'].warn = mockLogWarn

          ecoConfigService.getSolver.mockReturnValue(undefined) // No solver found

          const intentWithTokens = {
            hash: '0xTestHash',
            route: {
              destination: 999, // non-existent chain
              tokens: [{ token: '0xToken1', amount: 1000n }],
              calls: [],
            },
          } as any

          balanceService.fetchTokenBalances.mockResolvedValue({
            '0xToken1': {
              address: '0xToken1',
              balance: 1500n,
              decimals: { original: 6, current: BASE_DECIMALS },
            },
          })

          const result = await validationService['hasSufficientBalance'](intentWithTokens)

          expect(result).toBe(false)
          expect(mockLogWarn).toHaveBeenCalledWith(
            expect.objectContaining({
              msg: 'hasSufficientBalance: No solver targets found',
              intentHash: '0xTestHash',
              destination: 999,
            }),
          )
        })
      })
    })
  })

  describe('on assertValidations', () => {
    const updateInvalidIntentModel = jest.fn()
    const assetCases: Record<keyof ValidationChecks, string> = {
      supportedProver: 'supportedProver',
      supportedNative: 'supportedNative',
      supportedTargets: 'supportedTargets',
      supportedTransaction: 'supportedTransaction',
      validTransferLimit: 'validTransferLimit',
      validExpirationTime: 'validExpirationTime',
      validDestination: 'validDestination',
      fulfillOnDifferentChain: 'fulfillOnDifferentChain',
      sufficientBalance: 'sufficientBalance',
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
            tokens: [
              { token: '0x1', amount: 1n },
              { token: '0x2', amount: 2n },
            ],
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

        // Mock getIntentSources to return empty array to make checkProverWhitelisted return false
        ecoConfigService.getIntentSources.mockReturnValue([])

        validationService[fun] = jest.fn().mockReturnValueOnce(false)
        const validations = await validationService['assertValidations'](intent, solver)
        expect(validations[boolVarName]).toBe(false)
      })
    })
  })
})
