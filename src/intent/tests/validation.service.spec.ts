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
import { ProofType } from '@/contracts'
import { BalanceService } from '@/balance/balance.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Hex } from 'viem'
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
  let balanceService: DeepMocked<BalanceService>
  let kernelAccountClientService: DeepMocked<KernelAccountClientService>
  const mockLogLog = jest.fn()

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ValidationService,
        { provide: ProofService, useValue: createMock<ProofService>() },
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
      ],
    }).compile()

    validationService = mod.get(ValidationService)
    proofService = mod.get(ProofService)
    feeService = mod.get(FeeService)
    ecoConfigService = mod.get(EcoConfigService)
    utilsIntentService = mod.get(UtilsIntentService)
    balanceService = mod.get(BalanceService)
    kernelAccountClientService = mod.get(KernelAccountClientService)

    validationService['logger'].log = mockLogLog

    // Mock proofService methods to return a valid ProofType by default
    const mockProofType = {
      isHyperlane: jest.fn().mockReturnValue(true),
      isMetalayer: jest.fn().mockReturnValue(false),
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
      jest.spyOn(ecoConfigService, 'getIntentConfigs').mockReturnValue({ isNativeETHSupported: true } as any)
      validationService.onModuleInit()
      expect(validationService['isNativeETHSupported']).toBe(true)

      // Test when native is not supported
      jest.spyOn(ecoConfigService, 'getIntentConfigs').mockReturnValue({ isNativeETHSupported: false } as any)
      validationService.onModuleInit()
      expect(validationService['isNativeETHSupported']).toBe(false)
    })
  })

  describe('on validationsSucceeded', () => {
    it('should return false if any validations are false', async () => {
      const validations: ValidationChecks = {
        supportedProver: true,
        supportedNative: true,
        supportedTargets: true,
        supportedTransaction: true,
        validSourceMax: true,
        validTransferLimit: true,
        validExpirationTime: false,
        validDestination: true,
        fulfillOnDifferentChain: true,
      }
      expect(validationsSucceeded(validations)).toBe(false)
    })

    it('should return false if all validations are false', async () => {
      const validations: ValidationChecks = {
        supportedProver: false,
        supportedNative: false,
        supportedTargets: false,
        supportedTransaction: false,
        validSourceMax: false,
        validTransferLimit: false,
        validExpirationTime: false,
        validDestination: false,
        fulfillOnDifferentChain: false,
      }
      expect(validationsSucceeded(validations)).toBe(false)
    })

    it('should return true if all validations are true', async () => {
      const validations: ValidationChecks = {
        supportedProver: true,
        supportedNative: true,
        supportedTargets: true,
        supportedTransaction: true,
        validSourceMax: true,
        validTransferLimit: true,
        validExpirationTime: true,
        validDestination: true,
        fulfillOnDifferentChain: true,
      }
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
        const intent = {
          source: Number(sourceChainID),
          destination: Number(chainID),
          prover,
        } as any
        ecoConfigService.getIntentSources.mockReturnValue([
          { provers: [unsupportedProver], chainID: Number(chainID) } as any,
          { provers: [prover], chainID: Number(chainID) } as any,
        ])
        expect(validationService.supportedProver(intent)).toBe(true)
      })

      it('should succeed if multiple sources supports the prover', async () => {
        const intent = { source: Number(sourceChainID), destination: Number(chainID), prover } as any
        ecoConfigService.getIntentSources.mockReturnValue([
          { provers: [prover], chainID: Number(chainID) } as any,
          { provers: [prover], chainID: Number(chainID) } as any,
        ])
        expect(validationService.supportedProver(intent)).toBe(true)
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
          { target: '0x1', data: '0x12' },
          { target: '0x2', data: '0x3' },
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
          { target: '0x1', data: '0x12' },
          { target: '0x2', data: '0x34' },
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
          { target: '0x1', data: '0x12' },
          { target: '0x2', data: '0x34' },
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
          { target: '0x1', data: '0x12' },
          { target: '0x2', data: '0x34' },
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
        const intent = { route: { source: 1n }, hash: '0x123' } as any
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
        const intent = { 
          reward: { deadline: 100, prover: '0x123' }, 
          route: { source: 1n } 
        } as any
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

    describe('on validSourceMax', () => {
      const mockSolver = {
        chainID: 1,
        nativeMax: 1000000000000000000n, // 1 ETH max native balance
        targets: {
          '0x1234567890123456789012345678901234567890': {
            contractType: 'erc20',
            selectors: ['transfer(address,uint256)'],
            minBalance: 100,
            targetBalance: 1000,
            maxBalance: 5000,
          },
          '0xabcdef1234567890123456789012345678901234': {
            contractType: 'erc20',
            selectors: ['transfer(address,uint256)'],
            minBalance: 50,
            targetBalance: 500,
            maxBalance: 2500,
          },
          '0x9876543210987654321098765432109876543210': {
            contractType: 'erc20',
            selectors: ['transfer(address,uint256)'],
            minBalance: 100,
            targetBalance: 1000,
            // No maxBalance property
          },
        },
      } as any

      const mockIntent = {
        hash: '0xIntentHash',
        route: {
          source: 1n,
          calls: [{ value: 100000000000000000n }], // 0.1 ETH call value
        },
        reward: {
          tokens: [
            { token: '0x1234567890123456789012345678901234567890', amount: 1000000n }, // 1 token (6 decimals)
            { token: '0xabcdef1234567890123456789012345678901234', amount: 2000000n }, // 2 tokens (6 decimals)
          ],
          nativeValue: 200000000000000000n, // 0.2 ETH reward
        },
      } as any

      beforeEach(() => {
        jest.clearAllMocks()
      })

      it('should return false when no solver is found for source chain', async () => {
        ecoConfigService.getSolver.mockReturnValue(undefined)

        const result = await validationService['validSourceMax'](mockIntent)

        expect(result).toBe(false)
        expect(ecoConfigService.getSolver).toHaveBeenCalledWith(mockIntent.route.source)
      })

      it('should return true when no maxBalance is configured for any reward tokens', async () => {
        const intentWithNoMaxTokens = {
          ...mockIntent,
          reward: {
            tokens: [{ token: '0x9876543210987654321098765432109876543210', amount: 1000000n }],
            nativeValue: 0n,
          },
          route: {
            source: 1n,
            calls: [{ value: 0n }], // Ensure no native value in calls
          },
        }

        ecoConfigService.getSolver.mockReturnValue(mockSolver)

        const result = await validationService['validSourceMax'](intentWithNoMaxTokens)

        expect(result).toBe(true)
        expect(ecoConfigService.getSolver).toHaveBeenCalledWith(mockIntent.route.source)
      })

      it('should return true when projected balance does not exceed maxBalance', async () => {
        ecoConfigService.getSolver.mockReturnValue(mockSolver)

        // Mock current balances - well under maxBalance
        balanceService.fetchTokenBalance
          .mockResolvedValueOnce({
            address: '0x1234567890123456789012345678901234567890' as Hex,
            balance: 1000000n, // 1 token current balance
            decimals: 6,
          })
          .mockResolvedValueOnce({
            address: '0xabcdef1234567890123456789012345678901234' as Hex,
            balance: 500000n, // 0.5 token current balance
            decimals: 6,
          })

        // Mock kernel client for native balance check
        const mockClient = {
          kernelAccount: { address: '0xSolverWallet' as Hex },
          getBalance: jest.fn().mockResolvedValue(100000000000000000n), // 0.1 ETH current balance
        } as any
        kernelAccountClientService.getClient.mockResolvedValue(mockClient)

        const result = await validationService['validSourceMax'](mockIntent)

        expect(result).toBe(true)
        expect(balanceService.fetchTokenBalance).toHaveBeenCalledTimes(2)
        expect(balanceService.fetchTokenBalance).toHaveBeenCalledWith(
          1,
          '0x1234567890123456789012345678901234567890',
        )
        expect(balanceService.fetchTokenBalance).toHaveBeenCalledWith(
          1,
          '0xabcdef1234567890123456789012345678901234',
        )
      })

      it('should return false when projected balance exceeds maxBalance', async () => {
        ecoConfigService.getSolver.mockReturnValue(mockSolver)

        // Mock current balance that would exceed maxBalance when added to reward
        balanceService.fetchTokenBalance.mockResolvedValueOnce({
          address: '0x1234567890123456789012345678901234567890' as Hex,
          balance: 4500000000n, // 4500 tokens current balance (maxBalance is 5000)
          decimals: 6,
        })

        const result = await validationService['validSourceMax'](mockIntent)

        expect(result).toBe(false)
        expect(balanceService.fetchTokenBalance).toHaveBeenCalledWith(
          1,
          '0x1234567890123456789012345678901234567890',
        )
      })

      it('should handle different token decimals correctly', async () => {
        // Test with 18 decimal token
        const solverWith18Decimals = {
          ...mockSolver,
          targets: {
            '0x1234567890123456789012345678901234567890': {
              ...mockSolver.targets['0x1234567890123456789012345678901234567890'],
              maxBalance: 5000, // Still 5000 in dollar units
            },
            '0xabcdef1234567890123456789012345678901234': {
              ...mockSolver.targets['0xabcdef1234567890123456789012345678901234'],
              maxBalance: 2500, // Keep original maxBalance
            },
          },
        }

        ecoConfigService.getSolver.mockReturnValue(solverWith18Decimals)

        balanceService.fetchTokenBalance
          .mockResolvedValueOnce({
            address: '0x1234567890123456789012345678901234567890' as Hex,
            balance: 1000000000000000000n, // 1 token (18 decimals)
            decimals: 18,
          })
          .mockResolvedValueOnce({
            address: '0xabcdef1234567890123456789012345678901234' as Hex,
            balance: 500000n, // 0.5 tokens (6 decimals)
            decimals: 6,
          })

        // Mock kernel client
        const mockClient = {
          kernelAccount: { address: '0xSolverWallet' as Hex },
          getBalance: jest.fn().mockResolvedValue(100000000000000000n),
        } as any
        kernelAccountClientService.getClient.mockResolvedValue(mockClient)

        const result = await validationService['validSourceMax'](mockIntent)

        expect(result).toBe(true)
        expect(balanceService.fetchTokenBalance).toHaveBeenCalledTimes(2)
      })

      it('should use correct normalization for maxBalance', async () => {
        const solverWithCustomBalance = {
          ...mockSolver,
          targets: {
            '0x1234567890123456789012345678901234567890': {
              ...mockSolver.targets['0x1234567890123456789012345678901234567890'],
              maxBalance: 1000, // 1000 dollar units
            },
          },
        }

        ecoConfigService.getSolver.mockReturnValue(solverWithCustomBalance)

        // Mock balance that when normalized should be within limits
        balanceService.fetchTokenBalance.mockResolvedValueOnce({
          address: '0x1234567890123456789012345678901234567890' as Hex,
          balance: 500000000n, // 500 tokens (6 decimals)
          decimals: 6,
        })

        // Mock kernel client
        const mockClient = {
          kernelAccount: { address: '0xSolverWallet' as Hex },
          getBalance: jest.fn().mockResolvedValue(100000000000000000n),
        } as any
        kernelAccountClientService.getClient.mockResolvedValue(mockClient)

        const result = await validationService['validSourceMax'](mockIntent)

        expect(result).toBe(true)
      })

      it('should return false when error occurs during validation', async () => {
        ecoConfigService.getSolver.mockReturnValue(mockSolver)
        balanceService.fetchTokenBalance.mockRejectedValue(new Error('Balance fetch failed'))

        const result = await validationService['validSourceMax'](mockIntent)

        expect(result).toBe(false)
      })

      it('should return false when native balance exceeds nativeMax', async () => {
        // Create intent with only native rewards, no tokens
        const nativeOnlyIntent = {
          hash: '0xIntentHash',
          route: {
            source: 1n,
            calls: [{ value: 100000000000000000n }], // 0.1 ETH call value
          },
          reward: {
            tokens: [], // No token rewards
            nativeValue: 200000000000000000n, // 0.2 ETH reward
          },
        } as any

        ecoConfigService.getSolver.mockReturnValue(mockSolver)

        // Mock high current native balance that would exceed nativeMax when reward is added
        const mockClient = {
          kernelAccount: { address: '0xSolverWallet' as Hex },
          getBalance: jest.fn().mockResolvedValue(900000000000000000n), // 0.9 ETH current
        } as any
        kernelAccountClientService.getClient.mockResolvedValue(mockClient)

        // Intent has 0.2 ETH reward + 0.1 ETH call value = 0.3 ETH
        // Total would be 0.9 + 0.3 = 1.2 ETH, exceeding 1 ETH nativeMax

        const result = await validationService['validSourceMax'](nativeOnlyIntent)

        expect(result).toBe(false)
        expect(kernelAccountClientService.getClient).toHaveBeenCalledWith(1)
      })

      it('should return true for non-native intents when checking native max', async () => {
        const nonNativeIntent = {
          ...mockIntent,
          reward: {
            tokens: [{ token: '0x1234567890123456789012345678901234567890', amount: 1000000n }],
            nativeValue: 0n,
          },
          route: {
            source: 1n,
            calls: [{ value: 0n }], // No native value in calls
          },
        }

        ecoConfigService.getSolver.mockReturnValue(mockSolver)

        balanceService.fetchTokenBalance.mockResolvedValueOnce({
          address: '0x1234567890123456789012345678901234567890' as Hex,
          balance: 1000000n,
          decimals: 6,
        })

        const result = await validationService['validSourceMax'](nonNativeIntent)

        expect(result).toBe(true)
        // Should not call kernel client for non-native intents
        expect(kernelAccountClientService.getClient).not.toHaveBeenCalled()
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
      validSourceMax: 'validSourceMax',
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

        // Mock getIntentSources to return empty array to make checkProverWhitelisted return false
        ecoConfigService.getIntentSources.mockReturnValue([])

        validationService[fun] = jest.fn().mockReturnValueOnce(false)
        const validations = await validationService['assertValidations'](intent, solver)
        expect(validations[boolVarName]).toBe(false)
      })
    })
  })
})
