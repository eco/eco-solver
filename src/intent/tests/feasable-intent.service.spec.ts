import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { Model } from 'mongoose'
import { UtilsIntentService } from '../utils-intent.service'
import { BullModule, getQueueToken } from '@nestjs/bullmq'
import { QUEUES } from '../../common/redis/constants'
import { Queue } from 'bullmq'
import { BalanceService } from '../../balance/balance.service'
import { FeasableIntentService } from '../feasable-intent.service'
import { Hex } from 'viem'
import { EcoError } from '../../common/errors/eco-error'
import { getERC20Selector } from '../../contracts'
import { Network } from 'alchemy-sdk'

export const address1 = '0x1111111111111111111111111111111111111111'
export const address2 = '0x2222222222222222222222222222222222222222'

describe('FeasableIntentService', () => {
  let feasableIntentService: FeasableIntentService
  let balanceService: DeepMocked<BalanceService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let queue: DeepMocked<Queue>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        FeasableIntentService,
        { provide: BalanceService, useValue: createMock<BalanceService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: getModelToken(IntentSourceModel.name),
          useValue: createMock<Model<IntentSourceModel>>(),
        },
      ],
      imports: [
        BullModule.registerQueue({
          name: QUEUES.SOURCE_INTENT.queue,
        }),
      ],
    })
      .overrideProvider(getQueueToken(QUEUES.SOURCE_INTENT.queue))
      .useValue(createMock<Queue>())
      .compile()

    feasableIntentService = chainMod.get(FeasableIntentService)
    balanceService = chainMod.get(BalanceService)
    utilsIntentService = chainMod.get(UtilsIntentService)
    ecoConfigService = chainMod.get(EcoConfigService)
    queue = chainMod.get(getQueueToken(QUEUES.SOURCE_INTENT.queue))

    feasableIntentService['logger'].debug = mockLogDebug
    feasableIntentService['logger'].log = mockLogLog
    feasableIntentService['logger'].error = mockLogError
  })

  const mockData = { model: { intent: { logIndex: 1, hash: '0x123' as Hex } }, solver: {} }
  const validateExecution = { feasable: false, results: { a: 'b' } }
  const intentHash = mockData.model.intent.hash
  const jobId = `feasable-${intentHash}-${mockData.model.intent.logIndex}`
  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
  })

  describe('onModuleInit', () => {
    it('should set the intentJobConfig', async () => {
      const mockConfig = { foo: 'bar' }
      jest
        .spyOn(ecoConfigService, 'getRedis')
        .mockReturnValue({ jobs: { intentJobConfig: mockConfig } } as any)
      await feasableIntentService.onModuleInit()
      expect(feasableIntentService['intentJobConfig']).toEqual(mockConfig)
    })
    it('should set the fee', async () => {
      const mockFee = 1000n
      await feasableIntentService.onModuleInit()
      expect(feasableIntentService['fee']).toEqual(mockFee)
    })
  })

  describe('on feasableIntent', () => {
    it('should error out if processing intent data fails', async () => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(undefined)
      await expect(feasableIntentService.feasableIntent(intentHash)).resolves.not.toThrow()

      const error = new Error('noo')
      jest
        .spyOn(utilsIntentService, 'getIntentProcessData')
        .mockResolvedValue({ err: error } as any)
      await expect(feasableIntentService.feasableIntent(intentHash)).rejects.toThrow(error)
    })

    it('should update the db intent model if the intent is not feasable', async () => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(mockData as any)
      jest
        .spyOn(feasableIntentService, 'validateExecution')
        .mockResolvedValue(validateExecution as any)

      await feasableIntentService.feasableIntent(intentHash)

      expect(utilsIntentService.updateInfeasableIntentModel).toHaveBeenCalledWith(
        mockData.model,
        validateExecution.results,
      )
    })

    it('should add the intent when its feasable to the queue to be processed', async () => {
      jest.spyOn(utilsIntentService, 'getIntentProcessData').mockResolvedValue(mockData as any)
      jest
        .spyOn(feasableIntentService, 'validateExecution')
        .mockResolvedValue({ feasable: true } as any)

      await feasableIntentService.feasableIntent(intentHash)

      expect(mockLogDebug).toHaveBeenCalledTimes(2)
      expect(mockLogDebug).toHaveBeenNthCalledWith(2, {
        msg: `FeasableIntent intent ${intentHash}`,
        feasable: true,
        jobId,
      })
      expect(queue.add).toHaveBeenCalledWith(QUEUES.SOURCE_INTENT.jobs.fulfill_intent, intentHash, {
        jobId,
        ...feasableIntentService['intentJobConfig'],
      })
    })
  })

  describe('on validateExecution', () => {
    it('should fail if there are no targets to validate', async () => {
      const mockModel = { intent: { targets: [] } }
      const result = await feasableIntentService.validateExecution(mockModel as any, {} as any)
      expect(result).toEqual({ feasable: false, results: [] })
    })

    it('should fail if any of the targets fail', async () => {
      const mockModel = { intent: { targets: [{}, {}], data: [address1, address2] } }
      jest
        .spyOn(feasableIntentService, 'validateEachExecution')
        .mockImplementation(async ({}, {}, {}, data) => {
          const succeed = data == mockModel.intent.data[0]
          return { solvent: true, profitable: succeed }
        })
      const result = await feasableIntentService.validateExecution(mockModel as any, {} as any)
      expect(result).toEqual({
        feasable: false,
        results: [
          { solvent: true, profitable: true },
          { solvent: true, profitable: false },
        ],
      })
    })

    it('should succeed if all targets succeed', async () => {
      const mockModel = { intent: { targets: [{}, {}], data: [address1, address2] } }
      jest
        .spyOn(feasableIntentService, 'validateEachExecution')
        .mockResolvedValue({ solvent: true, profitable: true })
      const result = await feasableIntentService.validateExecution(mockModel as any, {} as any)
      expect(result).toEqual({
        feasable: true,
        results: [
          { solvent: true, profitable: true },
          { solvent: true, profitable: true },
        ],
      })
    })
  })

  describe('on validateEachExecution', () => {
    it('should fail if transaction can`t be destructured', async () => {
      jest.spyOn(utilsIntentService, 'getTransactionTargetData').mockImplementation(() => null)
      const result = await feasableIntentService.validateEachExecution(
        mockData.model as any,
        mockData.solver as any,
        {} as any,
        '0xddd',
      )
      expect(mockLogError).toHaveBeenCalledWith({
        msg: 'feasableIntent: Invalid transaction data',
        model: mockData.model,
        error: EcoError.FeasableIntentNoTransactionError.toString(),
      })
      expect(result).toBe(false)
    })

    it('should fail if the transaction isn`t on a ERC20 contract', async () => {
      jest
        .spyOn(utilsIntentService, 'getTransactionTargetData')
        .mockReturnValue({ targetConfig: { contractType: 'erc721' } } as any)
      expect(
        await feasableIntentService.validateEachExecution(
          mockData.model as any,
          mockData.solver as any,
          {} as any,
          '0xddd',
        ),
      ).toBe(false)
    })

    it('should succeed if the transaction is feasable', async () => {
      jest
        .spyOn(utilsIntentService, 'getTransactionTargetData')
        .mockReturnValue({ targetConfig: { contractType: 'erc20' } } as any)

      //check false
      jest
        .spyOn(feasableIntentService, 'handleErc20')
        .mockResolvedValue({ solvent: false, profitable: false })
      expect(
        await feasableIntentService.validateEachExecution(
          mockData.model as any,
          mockData.solver as any,
          {} as any,
          '0xddd',
        ),
      ).toEqual({ solvent: false, profitable: false })

      //check true
      jest
        .spyOn(feasableIntentService, 'handleErc20')
        .mockResolvedValue({ solvent: true, profitable: true })
      expect(
        await feasableIntentService.validateEachExecution(
          mockData.model as any,
          mockData.solver as any,
          {} as any,
          '0xddd',
        ),
      ).toEqual({ solvent: true, profitable: true })
    })
  })

  describe('on handleErc20', () => {
    it('should fail for unsupported selectors', async () => {
      expect(
        await feasableIntentService.handleErc20(
          { selector: 'asdf', decodedFunctionData: {} } as any,
          {} as any,
          {} as any,
          {} as any,
        ),
      ).toEqual(undefined)
    })

    describe('on transfer', () => {
      const amount = 100n
      const handleData = {
        selector: getERC20Selector('transfer'),
        decodedFunctionData: { args: [address1, amount] },
      }
      const mockModel = {
        event: { sourceNetwork: 'opt-sepolia' },
        intent: { rewardTokens: [address1], rewardAmounts: [200n] },
      }
      it('should fail a transfer where we lack the funds to fulfill', async () => {
        jest.spyOn(balanceService, 'getTokenBalance').mockResolvedValue({ balance: 0n } as any)
        expect(
          await feasableIntentService.handleErc20(
            handleData as any,
            mockModel as any,
            {} as any,
            {} as any,
          ),
        ).toEqual({ solvent: false, profitable: false })
      })

      it('should fail if we lack a matching source intent contract for the intent', async () => {
        jest.spyOn(balanceService, 'getTokenBalance').mockResolvedValue({ balance: amount } as any)
        jest
          .spyOn(ecoConfigService, 'getIntentSources')
          .mockReturnValue([{ network: 'base-sepolia' } as any])
        expect(
          await feasableIntentService.handleErc20(
            handleData as any,
            mockModel as any,
            {} as any,
            {} as any,
          ),
        ).toEqual(undefined)
      })

      it('should fail if the transfer is not profitable', async () => {
        jest.spyOn(balanceService, 'getTokenBalance').mockResolvedValue({ balance: amount } as any)
        jest
          .spyOn(ecoConfigService, 'getIntentSources')
          .mockReturnValue([{ network: mockModel.event.sourceNetwork } as any])
        jest.spyOn(feasableIntentService, 'isProfitableErc20Transfer').mockReturnValue(false)
        expect(
          await feasableIntentService.handleErc20(
            handleData as any,
            mockModel as any,
            {} as any,
            {} as any,
          ),
        ).toEqual({ solvent: true, profitable: false })
      })

      it('should succeed if the solver is solvent and the transfer is profitable', async () => {
        jest.spyOn(balanceService, 'getTokenBalance').mockResolvedValue({ balance: amount } as any)
        jest
          .spyOn(ecoConfigService, 'getIntentSources')
          .mockReturnValue([{ network: mockModel.event.sourceNetwork } as any])
        jest.spyOn(feasableIntentService, 'isProfitableErc20Transfer').mockReturnValue(true)
        expect(
          await feasableIntentService.handleErc20(
            handleData as any,
            mockModel as any,
            {} as any,
            {} as any,
          ),
        ).toEqual({ solvent: true, profitable: true })
      })
    })
  })

  describe('on isProfitableErc20Transfer', () => {
    const acceptedTokens = [address1, address2] as Hex[]
    const rewardTokens = [address1, address2] as Hex[]
    const rewardAmounts = [100n, 200n]
    const fullfillAmountUSDC = 300n

    beforeEach(async () => {
      await feasableIntentService.onModuleInit()
    })

    it('should return false if non of the reward tokens are accepted', async () => {
      expect(
        feasableIntentService.isProfitableErc20Transfer(
          Network.OPT_SEPOLIA,
          acceptedTokens,
          ['0x3'],
          rewardAmounts,
          fullfillAmountUSDC,
        ),
      ).toBe(false)
    })

    it('should return false if there are no reward tokens', async () => {
      expect(
        feasableIntentService.isProfitableErc20Transfer(
          Network.OPT_SEPOLIA,
          acceptedTokens,
          [],
          rewardAmounts,
          fullfillAmountUSDC,
        ),
      ).toBe(false)
    })

    it('should return false if the total reward sum is less than the cost of fulfillment plus a fee', async () => {
      expect(
        feasableIntentService.isProfitableErc20Transfer(
          Network.OPT_SEPOLIA,
          acceptedTokens,
          rewardTokens,
          [100n, 150n],
          fullfillAmountUSDC,
        ),
      ).toBe(false)
    })

    it('should return true if the erc20 transfer is profitable', async () => {
      expect(
        feasableIntentService.isProfitableErc20Transfer(
          Network.OPT_SEPOLIA,
          acceptedTokens,
          rewardTokens,
          rewardAmounts,
          fullfillAmountUSDC,
        ),
      ).toBe(true)
    })
  })

  describe('on convertToUSDC', () => {
    it('should return the correct conversion', async () => {
      const conversions = [
        { network: 'op1', token: address1, amount: 100n, conv: 100n },
        { network: 'op2', token: address2, amount: 200n, conv: 200n },
      ]
      conversions.forEach((conversion) => {
        expect(
          feasableIntentService.convertToUSDC(
            conversion.network as any,
            conversion.token as any,
            conversion.amount,
          ),
        ).toBe(conversion.conv)
      })
    })
  })
})
