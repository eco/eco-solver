import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Hex } from 'viem'
import { cloneDeep } from 'lodash'

import { CrowdLiquidityService } from '../crowd-liquidity.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { BalanceService } from '@/balance/balance.service'
import { UtilsIntentService } from '../utils-intent.service'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { Solver } from '@/eco-configs/eco-config.types'
import { EcoError } from '@/common/errors/eco-error'

describe('CrowdLiquidityService', () => {
  let service: CrowdLiquidityService
  let ecoConfigService: DeepMocked<EcoConfigService>
  let publicClientService: DeepMocked<MultichainPublicClientService>
  let balanceService: DeepMocked<BalanceService>
  let utilsIntentService: DeepMocked<UtilsIntentService>

  const mockConfig = {
    feePercentage: 1.0,
    supportedTokens: [
      {
        chainId: 1,
        tokenAddress: '0x1111111111111111111111111111111111111111' as Hex,
      },
    ],
    defaultTargetBalance: 1000,
    kernel: {
      address: '0x2222222222222222222222222222222222222222' as Hex,
    },
  }

  const mockSolver: Solver = {
    inboxAddress: '0x3333333333333333333333333333333333333333' as Hex,
    chainID: 1,
    targets: {},
    network: 'ethereum-mainnet' as any,
    fee: {} as any,
    nativeMax: 1000000000000000000n,
    averageBlockTime: 15,
  }

  const mockIntentModel: IntentSourceModel = {
    intent: {
      hash: '0x4444444444444444444444444444444444444444444444444444444444444444' as Hex,
      route: {
        source: 1n,
        destination: 1n,
        tokens: [
          {
            token: '0x1111111111111111111111111111111111111111' as Hex,
            amount: 1000n,
          },
        ],
        calls: [
          {
            target: '0x1111111111111111111111111111111111111111' as Hex,
            data: '0xa9059cbb' as Hex, // transfer selector
            value: 0n,
          },
        ],
      },
      reward: {
        tokens: [
          {
            token: '0x1111111111111111111111111111111111111111' as Hex,
            amount: 100n,
          },
        ],
      },
    },
    status: 'PENDING',
  } as IntentSourceModel

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrowdLiquidityService,
        {
          provide: EcoConfigService,
          useValue: createMock<EcoConfigService>(),
        },
        {
          provide: MultichainPublicClientService,
          useValue: createMock<MultichainPublicClientService>(),
        },
        {
          provide: BalanceService,
          useValue: createMock<BalanceService>(),
        },
        {
          provide: UtilsIntentService,
          useValue: createMock<UtilsIntentService>(),
        },
      ],
    }).compile()

    service = module.get<CrowdLiquidityService>(CrowdLiquidityService)
    ecoConfigService = module.get(EcoConfigService)
    publicClientService = module.get(MultichainPublicClientService)
    balanceService = module.get(BalanceService)
    utilsIntentService = module.get(UtilsIntentService)

    // Mock config service
    ecoConfigService.getCrowdLiquidity.mockReturnValue(mockConfig as any)

    // Initialize the service
    service.onModuleInit()

    // Mock updateIntentModel to return successful result by default
    utilsIntentService.updateIntentModel.mockResolvedValue({} as any)

    // Mock balance service methods that are called by isPoolSolvent
    balanceService.getInboxTokens.mockReturnValue([
      {
        chainId: 1,
        address: '0x1111111111111111111111111111111111111111' as Hex,
      },
    ] as any)

    balanceService.getAllTokenDataForAddress.mockResolvedValue([
      {
        config: {
          address: '0x1111111111111111111111111111111111111111' as Hex,
        },
        balance: {
          balance: 2000n, // Sufficient balance
        },
      },
    ] as any)

    // Mock the private _fulfill method to prevent it from being called during testing
    jest.spyOn(service as any, '_fulfill').mockImplementation(() => {
      throw new Error('_fulfill should be explicitly mocked in individual tests')
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('fulfill', () => {
    beforeEach(() => {
      // Mock reward and solvency checks to pass by default
      jest.spyOn(service, 'isRewardEnough').mockReturnValue(true)
      jest.spyOn(service, 'isPoolSolvent').mockResolvedValue(true)
    })

    describe('successful fulfillment', () => {
      const mockTransactionHash =
        '0x5555555555555555555555555555555555555555555555555555555555555555' as Hex

      beforeEach(() => {
        // Mock successful _fulfill call
        jest.spyOn(service as any, '_fulfill').mockResolvedValue(mockTransactionHash)
        // Reset mock counters
        utilsIntentService.updateIntentModel.mockClear()
      })

      it('should set status to CL_PROCESSING before fulfillment', async () => {
        const modelCopy = cloneDeep(mockIntentModel)

        // Capture the calls to updateIntentModel
        const calls: any[] = []
        utilsIntentService.updateIntentModel.mockImplementation((model) => {
          calls.push(cloneDeep(model))
          return Promise.resolve({} as any)
        })

        await service.fulfill(modelCopy, mockSolver)

        expect(calls).toHaveLength(2)
        expect(calls[0]).toEqual(
          expect.objectContaining({
            status: 'CL_PROCESSING',
          }),
        )
      })

      it('should set status to SOLVED after successful fulfillment', async () => {
        await service.fulfill(mockIntentModel, mockSolver)

        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...mockIntentModel,
          status: 'CL_SOLVED',
          receipt: { transactionHash: mockTransactionHash },
        })
      })

      it('should call updateIntentModel twice - once for CL_PROCESSING, once for CL_SOLVED', async () => {
        const modelCopy = cloneDeep(mockIntentModel)

        // Capture the calls to updateIntentModel
        const calls: any[] = []
        utilsIntentService.updateIntentModel.mockImplementation((model) => {
          calls.push(cloneDeep(model))
          return Promise.resolve({} as any)
        })

        await service.fulfill(modelCopy, mockSolver)

        expect(calls).toHaveLength(2)
        expect(calls[0]).toEqual(
          expect.objectContaining({
            status: 'CL_PROCESSING',
          }),
        )
        expect(calls[1]).toEqual(
          expect.objectContaining({
            status: 'CL_SOLVED',
            receipt: { transactionHash: mockTransactionHash },
          }),
        )
      })

      it('should return the transaction hash', async () => {
        const result = await service.fulfill(mockIntentModel, mockSolver)

        expect(result).toBe(mockTransactionHash)
      })
    })

    describe('failed fulfillment', () => {
      const mockError = new Error('Fulfillment failed')

      beforeEach(() => {
        // Mock failed _fulfill call
        jest.spyOn(service as any, '_fulfill').mockRejectedValue(mockError)
        // Reset mock counters
        utilsIntentService.updateIntentModel.mockClear()
      })

      it('should set status to CL_PROCESSING before fulfillment attempt', async () => {
        const modelCopy = cloneDeep(mockIntentModel)

        // Capture the calls to updateIntentModel
        const calls: any[] = []
        utilsIntentService.updateIntentModel.mockImplementation((model) => {
          calls.push(cloneDeep(model))
          return Promise.resolve({} as any)
        })

        try {
          await service.fulfill(modelCopy, mockSolver)
        } catch {
          // Expected to throw
        }

        expect(calls.length).toBeGreaterThanOrEqual(1)
        expect(calls[0]).toEqual(
          expect.objectContaining({
            status: 'CL_PROCESSING',
          }),
        )
      })

      it('should set status to FAILED after failed fulfillment', async () => {
        try {
          await service.fulfill(mockIntentModel, mockSolver)
        } catch {
          // Expected to throw
        }

        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...mockIntentModel,
          status: 'CL_FAILED',
          receipt: { error: mockError.message },
        })
      })

      it('should call updateIntentModel twice - once for CL_PROCESSING, once for FAILED', async () => {
        const modelCopy = cloneDeep(mockIntentModel)

        // Capture the calls to updateIntentModel
        const calls: any[] = []
        utilsIntentService.updateIntentModel.mockImplementation((model) => {
          calls.push(cloneDeep(model))
          return Promise.resolve({} as any)
        })

        try {
          await service.fulfill(modelCopy, mockSolver)
        } catch {
          // Expected to throw
        }

        expect(calls).toHaveLength(2)
        expect(calls[0]).toEqual(
          expect.objectContaining({
            status: 'CL_PROCESSING',
          }),
        )
        expect(calls[1]).toEqual(
          expect.objectContaining({
            status: 'CL_FAILED',
            receipt: { error: mockError.message },
          }),
        )
      })

      it('should re-throw the original error', async () => {
        await expect(service.fulfill(mockIntentModel, mockSolver)).rejects.toThrow(mockError)
      })

      it('should handle errors without message property', async () => {
        const errorWithoutMessage = { code: 'UNKNOWN_ERROR' }
        jest.spyOn(service as any, '_fulfill').mockRejectedValue(errorWithoutMessage)

        try {
          await service.fulfill(mockIntentModel, mockSolver)
        } catch {
          // Expected to throw
        }

        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...mockIntentModel,
          status: 'CL_FAILED',
          receipt: { error: errorWithoutMessage },
        })
      })
    })

    describe('pre-fulfillment validations', () => {
      it('should throw if reward is not enough', async () => {
        jest.spyOn(service, 'isRewardEnough').mockReturnValue(false)

        await expect(service.fulfill(mockIntentModel, mockSolver)).rejects.toThrow(
          EcoError.CrowdLiquidityRewardNotEnough(mockIntentModel.intent.hash),
        )

        // Should not call updateIntentModel if validation fails
        expect(utilsIntentService.updateIntentModel).not.toHaveBeenCalled()
      })

      it('should throw if pool is not solvent', async () => {
        // Mock isPoolSolvent to return false directly
        jest.spyOn(service, 'isPoolSolvent').mockResolvedValue(false)

        await expect(service.fulfill(mockIntentModel, mockSolver)).rejects.toThrow(
          EcoError.CrowdLiquidityPoolNotSolvent(mockIntentModel.intent.hash),
        )

        // Should not call updateIntentModel if validation fails
        expect(utilsIntentService.updateIntentModel).not.toHaveBeenCalled()
      })
    })

    describe('database update error handling', () => {
      const mockTransactionHash =
        '0x5555555555555555555555555555555555555555555555555555555555555555' as Hex

      it('should handle database update error during CL_PROCESSING status update', async () => {
        const dbError = new Error('Database connection failed')
        utilsIntentService.updateIntentModel.mockRejectedValueOnce(dbError)
        jest.spyOn(service as any, '_fulfill').mockResolvedValue(mockTransactionHash)

        await expect(service.fulfill(mockIntentModel, mockSolver)).rejects.toThrow(dbError)
      })

      it('should handle database update error during SOLVED status update', async () => {
        const dbError = new Error('Database connection failed')
        utilsIntentService.updateIntentModel
          .mockResolvedValueOnce({} as any) // First call succeeds (CL_PROCESSING)
          .mockRejectedValueOnce(dbError) // Second call fails (SOLVED)
        jest.spyOn(service as any, '_fulfill').mockResolvedValue(mockTransactionHash)

        await expect(service.fulfill(mockIntentModel, mockSolver)).rejects.toThrow(dbError)
      })

      it('should handle database update error during FAILED status update', async () => {
        const fulfillError = new Error('Fulfillment failed')
        const dbError = new Error('Database connection failed')
        utilsIntentService.updateIntentModel
          .mockResolvedValueOnce({} as any) // First call succeeds (CL_PROCESSING)
          .mockRejectedValueOnce(dbError) // Second call fails (FAILED)
        jest.spyOn(service as any, '_fulfill').mockRejectedValue(fulfillError)

        // Should throw the database error, not the original fulfillment error
        await expect(service.fulfill(mockIntentModel, mockSolver)).rejects.toThrow(dbError)
      })
    })

    describe('intent model mutation', () => {
      const mockTransactionHash =
        '0x5555555555555555555555555555555555555555555555555555555555555555' as Hex

      it('should mutate the original model object with status updates', async () => {
        const originalModel = { ...mockIntentModel }
        jest.spyOn(service as any, '_fulfill').mockResolvedValue(mockTransactionHash)

        await service.fulfill(originalModel, mockSolver)

        // The original model should be mutated with the final status
        expect(originalModel.status).toBe('CL_SOLVED')
        expect(originalModel.receipt).toEqual({ transactionHash: mockTransactionHash })
      })

      it('should mutate the original model object with failed status', async () => {
        const originalModel = { ...mockIntentModel }
        const error = new Error('Fulfillment failed')
        jest.spyOn(service as any, '_fulfill').mockRejectedValue(error)

        try {
          await service.fulfill(originalModel, mockSolver)
        } catch {
          // Expected to throw
        }

        // The original model should be mutated with the failed status
        expect(originalModel.status).toBe('CL_FAILED')
        expect(originalModel.receipt).toEqual({ error: error.message })
      })
    })
  })

  describe('isRewardEnough', () => {
    it('should return true when reward meets minimum threshold', () => {
      const model = {
        intent: {
          route: {
            tokens: [{ amount: 1000n }],
          },
          reward: {
            tokens: [{ amount: 1000n }], // Equals the fee percentage (1.0 = 100%)
          },
        },
      } as IntentSourceModel

      expect(service.isRewardEnough(model)).toBe(true)
    })

    it('should return false when reward is below minimum threshold', () => {
      const model = {
        intent: {
          route: {
            tokens: [{ amount: 1000n }],
          },
          reward: {
            tokens: [{ amount: 5n }], // 0.5% reward, feePercentage is 1%
          },
        },
      } as IntentSourceModel

      expect(service.isRewardEnough(model)).toBe(false)
    })
  })

  describe('isRouteSupported', () => {
    beforeEach(() => {
      jest.spyOn(service, 'isSupportedToken').mockReturnValue(true)
      jest.spyOn(service as any, 'isSupportedAction').mockReturnValue(true)
    })

    it('should return true for supported route', () => {
      expect(service.isRouteSupported(mockIntentModel)).toBe(true)
    })

    it('should return false if reward token is not supported', () => {
      jest.spyOn(service, 'isSupportedToken').mockReturnValue(false)

      expect(service.isRouteSupported(mockIntentModel)).toBe(false)
    })

    it('should return false if route call action is not supported', () => {
      jest.spyOn(service as any, 'isSupportedAction').mockReturnValue(false)

      expect(service.isRouteSupported(mockIntentModel)).toBe(false)
    })
  })

  describe('isSupportedToken', () => {
    it('should return true for supported token', () => {
      const result = service.isSupportedToken(
        1,
        '0x1111111111111111111111111111111111111111' as Hex,
      )

      expect(result).toBe(true)
    })

    it('should return false for unsupported token', () => {
      const result = service.isSupportedToken(
        2,
        '0x9999999999999999999999999999999999999999' as Hex,
      )

      expect(result).toBe(false)
    })
  })

  describe('getPoolAddress', () => {
    it('should return kernel address from config', () => {
      const result = service.getPoolAddress()

      expect(result).toBe(mockConfig.kernel.address)
    })
  })
})
