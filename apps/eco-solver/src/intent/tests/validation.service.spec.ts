const mockGetTransactionTargetData = jest.fn()
import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { TransactionTargetData, UtilsIntentService } from '@eco-solver/intent/utils-intent.service'
import { ProofService } from '@eco-solver/prover/proof.service'
import {
  ValidationChecks,
  ValidationService,
  validationsSucceeded,
} from '@eco-solver/intent/validation.sevice'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { entries } from 'lodash'
import { FeeService } from '@eco-solver/fee/fee.service'
import { FeeConfigType } from '@eco-solver/eco-configs/eco-config.types'
import { BalanceService } from '@eco-solver/balance/balance.service'
import { CrowdLiquidityService } from '@eco-solver/intent/crowd-liquidity.service'
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service'
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
  let crowdLiquidityService: DeepMocked<CrowdLiquidityService>
  let kernelAccountClientService: DeepMocked<KernelAccountClientService>
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
        { provide: CrowdLiquidityService, useValue: createMock<CrowdLiquidityService>() },
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
      ],
    }).compile()

    validationService = mod.get(ValidationService)
    proofService = mod.get(ProofService)
    feeService = mod.get(FeeService)
    balanceService = mod.get(BalanceService)
    ecoConfigService = mod.get(EcoConfigService)
    utilsIntentService = mod.get(UtilsIntentService)
    crowdLiquidityService = mod.get(CrowdLiquidityService)
    kernelAccountClientService = mod.get(KernelAccountClientService)

    validationService['logger'].log = mockLogLog

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

    // Mock fulfillment type - default to non-crowd-liquidity
    ecoConfigService.getFulfill.mockReturnValue({ type: 'smart-wallet-account' } as any)

    // Mock kernel account client service
    kernelAccountClientService.getAddress.mockResolvedValue('0xKernelAddress' as any)

    // Mock crowd liquidity service
    crowdLiquidityService.getPoolAddress.mockReturnValue('0xPoolAddress' as any)

    // Initialize the service
    validationService.onModuleInit()
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
        mockIsNativeIntent = jest.spyOn(require('@eco-solver/intent/utils'), 'isNativeIntent')
        mockEquivalentNativeGas = jest.spyOn(require('@eco-solver/intent/utils'), 'equivalentNativeGas')
        mockIsNativeETH = jest.spyOn(require('@eco-solver/intent/utils'), 'isNativeETH')
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
        mockGetFunctionTargets = jest.spyOn(require('@eco-solver/intent/utils'), 'getFunctionTargets')
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
          tokenBase6: 1000n * 10n ** 6n,
          nativeBase18: 1000n * 10n ** 18n,
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
          totalFillNormalized: { token: defaultFee.limit.tokenBase6 + 1n, native: 0n },
        })
        expect(await validationService.validTransferLimit({} as any)).toBe(false)
        expect(mockFeeConfig).toHaveBeenCalledTimes(1)

        jest.spyOn(feeService, 'getTotalFill').mockResolvedValueOnce({
          totalFillNormalized: { token: 0n, native: defaultFee.limit.nativeBase18 + 1n },
        })
        expect(await validationService.validTransferLimit({} as any)).toBe(false)
        expect(mockFeeConfig).toHaveBeenCalledTimes(2)

        jest.spyOn(feeService, 'getTotalFill').mockResolvedValueOnce({
          totalFillNormalized: {
            token: defaultFee.limit.tokenBase6 + 1n,
            native: defaultFee.limit.nativeBase18 + 1n,
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
            token: defaultFee.limit.tokenBase6,
            native: defaultFee.limit.nativeBase18,
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
            { token: '0xToken1', amount: 1000n },
            { token: '0xToken2', amount: 2000n },
          ],
          calls: [
            { target: '0x1', data: '0x', value: 100n },
            { target: '0x2', data: '0x', value: 200n },
          ],
        },
      } as any

      it('should return true when solver has sufficient token and native balances', async () => {
        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 },
          '0xToken2': { address: '0xToken2', balance: 2500n, decimals: 6 },
        })
        balanceService.getNativeBalance.mockResolvedValue(500n)

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(true)
        expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledWith(
          10,
          '0xKernelAddress',
          ['0xToken1', '0xToken2'],
        )
        expect(balanceService.getNativeBalance).toHaveBeenCalledWith(10, '0xKernelAddress')
      })

      it('should validate multiple wallet addresses in parallel and return true if any has sufficient balance', async () => {
        // Configure for crowd liquidity mode with multiple addresses
        ecoConfigService.getFulfill.mockReturnValue({ type: 'crowd-liquidity' } as any)

        const mockIntent = {
          hash: '0x123',
          route: {
            destination: 10,
            tokens: [{ token: '0xToken1', amount: 1000n }],
            calls: [],
          },
        } as any

        // Mock so that first wallet fails but second succeeds
        let callCount = 0
        balanceService.fetchWalletTokenBalances.mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            // First wallet - insufficient balance
            return Promise.resolve({
              '0xToken1': { address: '0xToken1', balance: 500n, decimals: 6 },
            })
          } else {
            // Second wallet - sufficient balance
            return Promise.resolve({
              '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 },
            })
          }
        })

        const result = await validationService['hasSufficientBalance'](mockIntent)

        expect(result).toBe(true)
        expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledTimes(2)
      })

      it('should return false when all wallet addresses have insufficient balance', async () => {
        // Configure for crowd liquidity mode with multiple addresses
        ecoConfigService.getFulfill.mockReturnValue({ type: 'crowd-liquidity' } as any)

        const mockIntent = {
          hash: '0x123',
          route: {
            destination: 10,
            tokens: [{ token: '0xToken1', amount: 2000n }],
            calls: [],
          },
        } as any

        // Mock all wallets to have insufficient balance
        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 500n, decimals: 6 },
        })

        const result = await validationService['hasSufficientBalance'](mockIntent)

        expect(result).toBe(false)
        expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledTimes(2)
      })

      it('should use Promise.all and return true if any address validation succeeds', async () => {
        // Configure for crowd liquidity mode
        ecoConfigService.getFulfill.mockReturnValue({ type: 'crowd-liquidity' } as any)

        const mockIntent = {
          hash: '0x123',
          route: {
            destination: 10,
            tokens: [{ token: '0xToken1', amount: 1000n }],
            calls: [{ target: '0x1', data: '0x', value: 100n }],
          },
        } as any

        // Mock different results for different addresses
        // First address has insufficient token balance (fails early)
        // Second address has sufficient balance for both tokens and native
        balanceService.fetchWalletTokenBalances
          .mockImplementationOnce(() =>
            Promise.resolve({
              '0xToken1': { address: '0xToken1', balance: 500n, decimals: 6 }, // insufficient
            }),
          )
          .mockImplementationOnce(() =>
            Promise.resolve({
              '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 }, // sufficient
            }),
          )

        balanceService.getNativeBalance
          .mockImplementationOnce(() => Promise.resolve(150n)) // sufficient (but won't be called for first address)
          .mockImplementationOnce(() => Promise.resolve(150n)) // sufficient

        const result = await validationService['hasSufficientBalance'](mockIntent)

        expect(result).toBe(true) // Should return true because second address has sufficient balance
        expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledTimes(2)
        expect(balanceService.getNativeBalance).toHaveBeenCalledTimes(1) // Only called for second address
      })

      it('should handle errors in parallel validation and still return true if any succeeds', async () => {
        // Configure for crowd liquidity mode
        ecoConfigService.getFulfill.mockReturnValue({ type: 'crowd-liquidity' } as any)

        const mockIntent = {
          hash: '0x123',
          route: {
            destination: 10,
            tokens: [{ token: '0xToken1', amount: 1000n }],
            calls: [],
          },
        } as any

        // First wallet throws error, second succeeds
        balanceService.fetchWalletTokenBalances
          .mockImplementationOnce(() => Promise.reject(new Error('Network error')))
          .mockImplementationOnce(() =>
            Promise.resolve({
              '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 }, // sufficient
            }),
          )

        const result = await validationService['hasSufficientBalance'](mockIntent)

        expect(result).toBe(true) // Should return true because second address validation succeeds
        expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledTimes(2)
      })

      it('should return false when solver has insufficient token balance', async () => {
        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 500n, decimals: 6 }, // insufficient
          '0xToken2': { address: '0xToken2', balance: 2500n, decimals: 6 },
        })
        balanceService.getNativeBalance.mockResolvedValue(500n)

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(false)
      })

      it('should return false when solver has insufficient native balance', async () => {
        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 },
          '0xToken2': { address: '0xToken2', balance: 2500n, decimals: 6 },
        })
        balanceService.getNativeBalance.mockResolvedValue(250n) // insufficient for 300n total

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(false)
      })

      it('should return false when token balance is missing', async () => {
        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 },
          // Missing '0xToken2'
        })
        balanceService.getNativeBalance.mockResolvedValue(500n)

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(false)
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

        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 },
          '0xToken2': { address: '0xToken2', balance: 2500n, decimals: 6 },
        })

        const result = await validationService['hasSufficientBalance'](intentWithoutNative)
        expect(result).toBe(true)
        expect(balanceService.getNativeBalance).not.toHaveBeenCalled()
      })

      it('should return false when balance service throws an error', async () => {
        balanceService.fetchWalletTokenBalances.mockRejectedValue(new Error('Network error'))

        const result = await validationService['hasSufficientBalance'](mockIntent)
        expect(result).toBe(false)
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

        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 },
          '0xToken2': { address: '0xToken2', balance: 2500n, decimals: 6 },
        })
        balanceService.getNativeBalance.mockResolvedValue(500n)

        const result = await validationService['hasSufficientBalance'](intentWithMixedCalls)
        expect(result).toBe(true)
        expect(balanceService.getNativeBalance).toHaveBeenCalledWith(10, '0xKernelAddress')
      })

      it('should correctly handle token minimum balance requirements with solver targets', async () => {
        const mockSolver = {
          inboxAddress: '0x123',
          network: 'mainnet',
          fee: {},
          chainID: 10n,
          averageBlockTime: 12000,
          targets: {
            '0xToken1': { minBalance: 50 }, // $50 minimum
            '0xToken2': { minBalance: 100 }, // $100 minimum
          },
        } as any
        ecoConfigService.getSolver.mockReturnValue(mockSolver)

        const intentWithTokens = {
          ...mockIntent,
          route: {
            ...mockIntent.route,
            tokens: [
              { token: '0xToken1', amount: 1000n }, // requesting 1000 units
              { token: '0xToken2', amount: 500n }, // requesting 500 units
            ],
            calls: [], // no native calls
          },
        }

        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          // Token1: balance 1100, minReq 50 (normalized to token decimals), available = 1100-50 = 1050, need 1000 ✓
          '0xToken1': { address: '0xToken1', balance: 1100n, decimals: 6 },
          // Token2: balance 550, minReq 100 (normalized to token decimals), available = 550-100 = 450, need 500 ✗
          '0xToken2': { address: '0xToken2', balance: 550n, decimals: 6 },
        })

        const result = await validationService['hasSufficientBalance'](intentWithTokens)
        expect(result).toBe(false) // Should fail because Token2 insufficient after min balance
      })

      it('should pass when solver has no specific minimum balance requirements for tokens', async () => {
        const mockSolver = {
          inboxAddress: '0x123',
          network: 'mainnet',
          fee: {},
          chainID: 10n,
          averageBlockTime: 12000,
          targets: {
            '0xToken1': {}, // no minBalance specified, defaults to 0
            '0xToken2': { minBalance: 0 }, // explicitly 0
          },
        } as any
        ecoConfigService.getSolver.mockReturnValue(mockSolver)

        const intentWithTokens = {
          ...mockIntent,
          route: {
            ...mockIntent.route,
            tokens: [
              { token: '0xToken1', amount: 1000n },
              { token: '0xToken2', amount: 500n },
            ],
            calls: [],
          },
        }

        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 1000n, decimals: 6 }, // exactly enough
          '0xToken2': { address: '0xToken2', balance: 500n, decimals: 6 }, // exactly enough
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

        balanceService.fetchWalletTokenBalances.mockResolvedValue({})
        // Only 50n available, but need 100n
        balanceService.getNativeBalance.mockResolvedValue(50n)

        const result = await validationService['hasSufficientBalance'](intentWithNativeValue)

        expect(result).toBe(false)
        expect(mockLogWarn).toHaveBeenCalledWith(
          expect.objectContaining({
            msg: 'hasSufficientBalance: Insufficient native balance',
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
            '0xToken1': { minBalance: 100 },
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

        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 500n, decimals: 6 },
        })

        const result = await validationService['hasSufficientBalance'](intentWithTokens)

        expect(result).toBe(false)
        expect(mockLogWarn).toHaveBeenCalledWith(
          expect.objectContaining({
            msg: 'hasSufficientBalance: Insufficient token balance',
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

        balanceService.fetchWalletTokenBalances.mockResolvedValue({
          '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 },
        })

        const result = await validationService['hasSufficientBalance'](intentWithTokens)

        expect(result).toBe(false)
        expect(mockLogWarn).toHaveBeenCalledWith(
          expect.objectContaining({
            msg: 'hasSufficientBalance: No solver configured for destination chain',
            intentHash: '0xTestHash',
            destination: 999,
          }),
        )
      })

      it('should return true when no tokens and no native value required', async () => {
        const intentWithNothing = {
          hash: '0xTestHash',
          route: {
            destination: 10,
            tokens: [],
            calls: [
              { target: '0x1', data: '0x', value: 0n },
              { target: '0x2', data: '0x', value: 0n },
            ],
          },
        } as any

        const result = await validationService['hasSufficientBalance'](intentWithNothing)

        expect(result).toBe(true)
        expect(balanceService.fetchWalletTokenBalances).not.toHaveBeenCalled()
        expect(balanceService.getNativeBalance).not.toHaveBeenCalled()
      })

      describe('crowd liquidity pool balance checking', () => {
        beforeEach(() => {
          // Configure for crowd liquidity mode
          ecoConfigService.getFulfill.mockReturnValue({ type: 'crowd-liquidity' } as any)
        })

        it('should check balances for all addresses in parallel and return true if any has sufficient balance', async () => {
          const mockIntent = {
            hash: '0xTestHash',
            route: {
              destination: 10,
              tokens: [{ token: '0xToken1', amount: 1000n }],
              calls: [],
            },
          } as any

          // First address has insufficient, second has sufficient
          balanceService.fetchWalletTokenBalances.mockImplementation((chainId, address) => {
            if (address === '0xKernelAddress') {
              return Promise.resolve({
                '0xToken1': { address: '0xToken1', balance: 500n, decimals: 6 }, // insufficient
              })
            } else {
              return Promise.resolve({
                '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 }, // sufficient
              })
            }
          })

          const result = await validationService['hasSufficientBalance'](mockIntent)

          expect(result).toBe(true)
          expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledTimes(2)
          expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledWith(
            10,
            '0xKernelAddress',
            ['0xToken1'],
          )
          expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledWith(
            10,
            '0xPoolAddress',
            ['0xToken1'],
          )
        })

        it('should fail if all addresses have insufficient balance in crowd-liquidity mode', async () => {
          const mockIntent = {
            hash: '0xTestHash',
            route: {
              destination: 10,
              tokens: [{ token: '0xToken1', amount: 1000n }],
              calls: [],
            },
          } as any

          // Both addresses have insufficient balance
          balanceService.fetchWalletTokenBalances.mockResolvedValue({
            '0xToken1': { address: '0xToken1', balance: 400n, decimals: 6 },
          })

          const result = await validationService['hasSufficientBalance'](mockIntent)

          expect(result).toBe(false)
          expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledTimes(2)
        })

        it('should check native balances for all addresses in parallel and return true if any has sufficient', async () => {
          const mockIntent = {
            hash: '0xTestHash',
            route: {
              destination: 10,
              tokens: [],
              calls: [{ target: '0x1', data: '0x', value: 100n }],
            },
          } as any

          // First address insufficient, second sufficient
          balanceService.getNativeBalance.mockImplementation((chainId, address) => {
            if (address === '0xKernelAddress') {
              return Promise.resolve(50n) // insufficient
            } else {
              return Promise.resolve(150n) // sufficient
            }
          })

          const result = await validationService['hasSufficientBalance'](mockIntent)

          expect(result).toBe(true)
          expect(balanceService.getNativeBalance).toHaveBeenCalledTimes(2)
          expect(balanceService.getNativeBalance).toHaveBeenCalledWith(10, '0xKernelAddress')
          expect(balanceService.getNativeBalance).toHaveBeenCalledWith(10, '0xPoolAddress')
        })

        it('should validate all addresses in parallel even if one throws an error', async () => {
          const mockIntent = {
            hash: '0xTestHash',
            route: {
              destination: 10,
              tokens: [{ token: '0xToken1', amount: 1000n }],
              calls: [],
            },
          } as any

          // First address throws error, second has sufficient balance
          balanceService.fetchWalletTokenBalances.mockImplementation((chainId, address) => {
            if (address === '0xKernelAddress') {
              return Promise.reject(new Error('Network error'))
            } else {
              return Promise.resolve({
                '0xToken1': { address: '0xToken1', balance: 1500n, decimals: 6 }, // sufficient
              })
            }
          })

          const result = await validationService['hasSufficientBalance'](mockIntent)

          expect(result).toBe(true) // Should still pass because second address has sufficient balance
          expect(balanceService.fetchWalletTokenBalances).toHaveBeenCalledTimes(2)
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
