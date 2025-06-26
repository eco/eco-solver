const mockEncodeFunctionData = jest.fn()
const mockGetTransactionTargetData = jest.fn()
const mockEncodeAbiParameters = jest.fn()
const mockGetChainConfig = jest.fn()
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { FeeService } from '@/fee/fee.service'
import { Hex, zeroAddress, pad } from 'viem'
import { IntentDataModel } from '@/intent/schemas/intent-data.schema'
import { IntentSourceModel } from '@/intent/schemas/intent-source.schema'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { ProofService } from '@/prover/proof.service'
import { RewardDataModel } from '@/intent/schemas/reward-data.schema'
import { Test, TestingModule } from '@nestjs/testing'
import { UtilsIntentService } from '@/intent/utils-intent.service'
import { WalletFulfillService } from '@/intent/wallet-fulfill.service'

jest.mock('viem', () => {
  return {
    ...jest.requireActual('viem'),
    encodeFunctionData: mockEncodeFunctionData,
    encodeAbiParameters: mockEncodeAbiParameters,
  }
})

jest.mock('@/intent/utils', () => {
  return {
    ...jest.requireActual('@/intent/utils'),
    getTransactionTargetData: mockGetTransactionTargetData,
  }
})

jest.mock('@/eco-configs/utils', () => {
  return {
    ...jest.requireActual('@/eco-configs/utils'),
    getChainConfig: mockGetChainConfig,
  }
})
describe('WalletFulfillService', () => {
  const address1 = '0x1111111111111111111111111111111111111111'
  const address2 = '0x2222222222222222222222222222222222222222'
  const address3 = '0x3333333333333333333333333333333333333333'

  let fulfillIntentService: WalletFulfillService
  let accountClientService: DeepMocked<KernelAccountClientService>
  let proofService: DeepMocked<ProofService>
  let feeService: DeepMocked<FeeService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let mockFinalFeasibilityCheck: jest.SpyInstance<Promise<void>, [intent: IntentDataModel], any>
  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        WalletFulfillService,
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
        { provide: ProofService, useValue: createMock<ProofService>() },
        { provide: FeeService, useValue: createMock<FeeService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        { provide: CrowdLiquidityService, useValue: createMock<EcoConfigService>() },
      ],
    }).compile()

    fulfillIntentService = chainMod.get(WalletFulfillService)
    accountClientService = chainMod.get(KernelAccountClientService)
    proofService = chainMod.get(ProofService)
    feeService = chainMod.get(FeeService)
    utilsIntentService = chainMod.get(UtilsIntentService)
    ecoConfigService = chainMod.get(EcoConfigService)

    fulfillIntentService['logger'].debug = mockLogDebug
    fulfillIntentService['logger'].log = mockLogLog
    fulfillIntentService['logger'].error = mockLogError

    // make sure it returns something real
    fulfillIntentService['getHyperlaneFee'] = jest.fn().mockReturnValue(0n)
  })
  const hash = address1
  const claimant = address2
  const solver = { inboxAddress: address1, chainID: 8453n } as any
  const model = {
    intent: {
      route: { hash, destination: 1n, calls: [], getHash: () => '0x6543' },
      reward: { getHash: () => '0x123abc' },
      getHash: () => {
        return { intentHash: '0xaaaa999' }
      },
    },
    event: { sourceChainID: 11111 },
  } as any
  const emptyTxs = [{ data: undefined, to: hash, value: 0n }]

  beforeEach(async () => {
    //dont have it throw
    mockFinalFeasibilityCheck = jest
      .spyOn(fulfillIntentService, 'finalFeasibilityCheck')
      .mockResolvedValue()
  })
  afterEach(async () => {
    // restore the spy created with spyOn
    jest.restoreAllMocks()
    mockLogDebug.mockClear()
    mockLogLog.mockClear()
    mockLogError.mockClear()
    mockEncodeFunctionData.mockClear()
    delete (model as any).status
    delete (model as any).receipt
  })

  describe('on fulfill', () => {
    describe('on setup', () => {
      it('should set the claimant for the fulfill', async () => {
        jest.spyOn(accountClientService, 'getClient').mockImplementation((): any =>
          Promise.resolve({
            execute: jest.fn().mockResolvedValue(hash),
            waitForTransactionReceipt: jest.fn().mockResolvedValue({ transactionHash: hash }),
          }),
        )

        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ model, solver })
        const mockGetFulfillIntentTx = jest.fn().mockResolvedValue({ value: 0n })
        fulfillIntentService['getFulfillIntentTx'] = mockGetFulfillIntentTx
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        expect(await fulfillIntentService.fulfill(model, solver)).toBe(hash)
        expect(mockGetFulfillIntentTx).toHaveBeenCalledWith(solver.inboxAddress, model)
      })

      it('should throw if the finalFeasibilityCheck throws', async () => {
        const error = new Error('stuff went bad')
        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ model, solver })
        const mockGetFulfillIntentTx = jest.fn().mockResolvedValue({ value: 0n })
        fulfillIntentService['getFulfillIntentTx'] = mockGetFulfillIntentTx
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        jest.spyOn(fulfillIntentService, 'finalFeasibilityCheck').mockImplementation(async () => {
          throw error
        })

        await expect(() => fulfillIntentService.fulfill(model, solver)).rejects.toThrow(error)
      })
    })

    describe('on failed execution', () => {
      it('should bubble up the thrown error', async () => {
        const error = new Error('stuff went bad')
        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ model, solver })
        fulfillIntentService['getFulfillIntentData'] = jest.fn()
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])
        fulfillIntentService['getFulfillTxForHyperproverSingle'] = jest
          .fn()
          .mockReturnValue(emptyTxs[0])
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        jest.spyOn(accountClientService, 'getClient').mockImplementation(async () => {
          return {
            execute: () => {
              throw error
            },
          } as any
        })
        await expect(() => fulfillIntentService.fulfill(model, solver)).rejects.toThrow(error)
      })

      it('should fail on receipt status reverted', async () => {
        const receipt = { status: 'reverted' }
        const error = EcoError.FulfillIntentRevertError(receipt as any)
        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ model, solver })
        fulfillIntentService['getFulfillIntentData'] = jest.fn()
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])
        fulfillIntentService['getFulfillIntentTx'] = jest.fn().mockReturnValue(emptyTxs[0])
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        jest.spyOn(accountClientService, 'getClient').mockImplementation(async () => {
          return {
            execute: () => {
              return '0x33'
            },
            waitForTransactionReceipt: () => {
              return receipt
            },
          } as any
        })
        await expect(() => fulfillIntentService.fulfill(model, solver)).rejects.toThrow(error)
        expect(mockLogError).toHaveBeenCalledTimes(1)
        expect((model as any).status).toBe('FAILED')
        expect(mockLogError).toHaveBeenCalledWith({
          msg: `fulfillIntent: Invalid transaction`,
          error: EcoError.FulfillIntentBatchError.toString(),
          model,
          errorPassed: error,
          flatExecuteData: emptyTxs,
        })
      })

      it('should log error', async () => {
        const error = new Error('stuff went bad')
        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ model, solver })
        fulfillIntentService['getFulfillIntentData'] = jest.fn()
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])
        fulfillIntentService['getFulfillTxForHyperproverSingle'] = jest
          .fn()
          .mockReturnValue(emptyTxs[0])
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        jest.spyOn(accountClientService, 'getClient').mockImplementation(async () => {
          return {
            execute: () => {
              throw error
            },
          } as any
        })
        await expect(() => fulfillIntentService.fulfill(model, solver)).rejects.toThrow(error)
        expect(mockLogError).toHaveBeenCalledTimes(1)
        expect(mockLogError).toHaveBeenCalledWith({
          msg: `fulfillIntent: Invalid transaction`,
          error: EcoError.FulfillIntentBatchError.toString(),
          model,
          errorPassed: error,
          flatExecuteData: emptyTxs,
        })
      })

      it('should update the db model with status and error receipt', async () => {
        const error = new Error('stuff went bad')
        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ model, solver })
        fulfillIntentService['getFulfillIntentData'] = jest.fn()
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])
        fulfillIntentService['getFulfillTxForHyperproverSingle'] = jest
          .fn()
          .mockReturnValue(emptyTxs[0])
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        jest.spyOn(accountClientService, 'getClient').mockImplementation(async () => {
          return {
            execute: () => {
              throw error
            },
          } as any
        })
        await expect(() => fulfillIntentService.fulfill(model, solver)).rejects.toThrow(error)
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledTimes(1)
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...model,
          status: 'FAILED',
          receipt: error,
        })

        //check error stacking
        const error2 = new Error('stuff went bad a second time')
        jest.spyOn(accountClientService, 'getClient').mockImplementation(async () => {
          return {
            execute: () => {
              throw error2
            },
          } as any
        })

        await expect(() => fulfillIntentService.fulfill(model, solver)).rejects.toThrow(error2)
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledTimes(2)
        expect(utilsIntentService.updateIntentModel).toHaveBeenLastCalledWith({
          ...model,
          status: 'FAILED',
          receipt: { previous: error, current: error2 },
        })
      })
    })

    describe('on successful execution', () => {
      const transactionHash = '0x33'
      const mockExecute = jest.fn()
      const mockWaitForTransactionReceipt = jest.fn()
      const mockGetIntentProcessData = jest.fn()
      beforeEach(async () => {
        fulfillIntentService['getFulfillIntentTx'] = jest.fn().mockReturnValue(emptyTxs)
        utilsIntentService.getIntentProcessData = mockGetIntentProcessData.mockResolvedValue({
          model,
          solver,
        })
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])

        jest.spyOn(accountClientService, 'getClient').mockImplementation(async () => {
          return {
            execute: mockExecute.mockResolvedValue(transactionHash),
            waitForTransactionReceipt: mockWaitForTransactionReceipt.mockResolvedValue({
              transactionHash,
            }),
          } as any
        })

        expect(await fulfillIntentService.fulfill(model, solver)).resolves
        expect(fulfillIntentService['getTransactionsForTargets']).toHaveBeenCalledTimes(1)
        expect(fulfillIntentService['getFulfillIntentTx']).toHaveBeenCalledTimes(1)
      })

      afterEach(() => {
        jest.restoreAllMocks()
        mockExecute.mockClear()
        mockWaitForTransactionReceipt.mockClear()
        mockGetIntentProcessData.mockClear()
      })

      it('should execute the transactions', async () => {
        expect(mockExecute).toHaveBeenCalledTimes(1)
        expect(mockExecute).toHaveBeenCalledWith([emptyTxs])
      })

      it('should get a receipt', async () => {
        expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(1)
        expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith({
          hash: transactionHash,
          timeout: 300000,
        })
      })

      it('should log', async () => {
        expect(mockLogDebug).toHaveBeenCalledTimes(2)
        expect(mockLogDebug).toHaveBeenNthCalledWith(2, {
          msg: `Fulfilled transactionHash ${transactionHash}`,
          userOPHash: { transactionHash },
          destinationChainID: model.intent.route.destination,
          sourceChainID: IntentSourceModel.getSource(model),
        })
      })

      it('should update the db model with status and receipt', async () => {
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledTimes(1)
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...model,
          status: 'SOLVED',
          fulfilledBySelf: true,
          receipt: { transactionHash },
        })
      })
    })
  })

  describe('on finalFeasibilityCheck', () => {
    const error = new Error('stuff went bad')
    beforeEach(async () => {
      mockFinalFeasibilityCheck.mockRestore()
    })
    it('should throw if the model is not feasible', async () => {
      jest.spyOn(feeService, 'isRouteFeasible').mockResolvedValue({ error })
      await expect(fulfillIntentService.finalFeasibilityCheck({} as any)).rejects.toThrow(error)
    })

    it('should not throw if the model is feasible', async () => {
      jest.spyOn(feeService, 'isRouteFeasible').mockResolvedValue({ error: undefined })
      await expect(fulfillIntentService.finalFeasibilityCheck({} as any)).resolves.not.toThrow()
    })
  })

  describe('on handleErc20', () => {
    const selector = '0xa9059cbb'
    const inboxAddress = '0x131'
    const target = '0x9'
    const amount = 100n
    it('should return empty on unsupported selector', async () => {
      expect(
        fulfillIntentService.handleErc20(
          { selector: address1, targetConfig: {} } as any,
          {} as any,
          '0x0',
        ),
      ).toEqual([])
    })

    it('should return the approve selector with data correctly encoded', async () => {
      const transferFunctionData = '0x9911'
      mockEncodeFunctionData.mockReturnValue(transferFunctionData)
      expect(
        fulfillIntentService.handleErc20(
          { selector, decodedFunctionData: { args: [, amount] } } as any,
          { inboxAddress } as any,
          target,
        ),
      ).toEqual([{ to: target, data: transferFunctionData, value: 0n }])
      expect(mockEncodeFunctionData).toHaveBeenCalledWith({
        abi: expect.anything(),
        functionName: 'approve',
        args: [inboxAddress, amount],
      })
    })
  })

  describe('on getTransactionsForTargets', () => {
    const model = {
      intent: { route: { calls: [{ target: address1, data: address2, value: 0n }] } },
    } as any
    const tt = { targetConfig: { contractType: 'erc20' } }

    it('should return empty if no targets', async () => {
      expect(
        fulfillIntentService['getTransactionsForTargets'](
          { intent: { route: { calls: [] } } } as any,
          {} as any,
        ),
      ).toEqual([])
    })

    it('should return empty item for invalid transaction target data', async () => {
      mockGetTransactionTargetData.mockReturnValue(null)
      expect(fulfillIntentService['getTransactionsForTargets'](model, solver)).toEqual([])
      expect(mockGetTransactionTargetData).toHaveBeenCalledWith(solver, model.intent.route.calls[0])
      expect(mockLogError).toHaveBeenCalledTimes(1)
      expect(mockLogError).toHaveBeenCalledWith({
        msg: `fulfillIntent: Invalid transaction data`,
        error: EcoError.FulfillIntentNoTransactionError.toString(),
        model,
      })
    })

    it('should return empty for erc721, erc1155, or anything other than erc20', async () => {
      //erc721
      mockGetTransactionTargetData.mockReturnValue({ targetConfig: { contractType: 'erc721' } })
      expect(fulfillIntentService['getTransactionsForTargets'](model, solver)).toEqual([])

      //erc1155
      mockGetTransactionTargetData.mockReturnValue({ targetConfig: { contractType: 'erc1155' } })
      expect(fulfillIntentService['getTransactionsForTargets'](model, solver)).toEqual([])

      //default/catch-all
      mockGetTransactionTargetData.mockReturnValue({ targetConfig: { contractType: 'face' } })
      expect(fulfillIntentService['getTransactionsForTargets'](model, solver)).toEqual([])
    })

    it('should return correct data for erc20', async () => {
      const mockHandleErc20Data = [{ to: address1, data: address2 }]
      mockGetTransactionTargetData.mockReturnValue(tt)
      fulfillIntentService.handleErc20 = jest.fn().mockReturnValue(mockHandleErc20Data)
      expect(fulfillIntentService['getTransactionsForTargets'](model, solver)).toEqual(
        mockHandleErc20Data,
      )
    })

    it('should process multiple targets', async () => {
      const model = {
        intent: {
          route: {
            calls: [
              { target: address1, data: '0x3', value: 0n },
              { target: address2, data: '0x4', value: 0n },
            ],
          },
        },
      } as any
      const mockHandleErc20Data = [
        { to: '0x11', data: '0x22' },
        { to: '0x33', data: '0x44' },
      ]
      mockGetTransactionTargetData.mockReturnValue(tt)
      fulfillIntentService.handleErc20 = jest.fn().mockImplementation((tt, solver, target) => {
        if (target === model.intent.route.calls[0].target) return mockHandleErc20Data[0]
        if (target === model.intent.route.calls[1].target) return mockHandleErc20Data[1]
      })
      expect(fulfillIntentService['getTransactionsForTargets'](model, solver)).toEqual(
        mockHandleErc20Data,
      )
    })
  })

  describe('on getFulfillIntentTx', () => {
    const model = {
      intent: {
        hash: '0x1234',
        route: {
          calls: [{ target: address1, data: address2, value: 0n }],
          deadline: '0x2233',
          salt: '0x3344',
          source: 10,
          destination: 11,
          getHash: () => '0xccc',
        },
        reward: {
          prover: '0x1122',
          getHash: () => '0xab33',
        },
        getHash: () => {
          return { intentHash: '0xaaaa999' }
        },
      },
      event: { sourceChainID: 10 },
    }
    const solver = { inboxAddress: '0x9' as Hex }
    let defaultArgs = [] as any
    const mockFee = 10n
    beforeEach(() => {
      jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
      fulfillIntentService['getHyperlaneFee'] = jest.fn().mockResolvedValue(mockFee)
      defaultArgs = [
        model.intent.route,
        model.intent.reward.getHash(),
        claimant,
        model.intent.getHash().intentHash,
      ]
    })

    describe('on PROOF_METALAYER', () => {
      it('should use the correct function name and args', async () => {
        jest.spyOn(proofService, 'isMetalayerProver').mockReturnValue(true)
        jest.spyOn(proofService, 'isHyperlaneProver').mockReturnValue(false)
        fulfillIntentService['getFulfillTxForMetalayer'] = jest.fn().mockReturnValue(emptyTxs[0])
        await fulfillIntentService['getFulfillIntentTx'](solver.inboxAddress, model as any)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledTimes(1)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledWith(
          Number(model.intent.route.source),
          model.intent.reward.prover,
        )
        expect(proofService.isMetalayerProver).toHaveBeenCalledTimes(1)
        expect(proofService.isMetalayerProver).toHaveBeenCalledWith(
          Number(model.intent.route.source),
          model.intent.reward.prover,
        )
        expect(fulfillIntentService['getFulfillTxForMetalayer']).toHaveBeenCalledTimes(1)
      })

      it('should use the correct function name and args for getFulfillTxForMetalayer', async () => {
        const data = '0x9911'
        jest.spyOn(proofService, 'isMetalayerProver').mockReturnValue(true)
        jest.spyOn(proofService, 'isHyperlaneProver').mockReturnValue(false)
        mockEncodeFunctionData.mockReturnValue(data)
        fulfillIntentService['getFulfillment'] = jest
          .fn()
          .mockReturnValue('getFulfillTxForMetalayer')
        defaultArgs.push(model.intent.reward.prover)
        defaultArgs.push('0x0')
        defaultArgs.push(zeroAddress)
        const metaproverTx = { to: solver.inboxAddress, data, value: mockFee }
        fulfillIntentService['getFulfillTxForMetalayer'] = jest.fn().mockReturnValue(metaproverTx)

        const tx = await fulfillIntentService['getFulfillIntentTx'](
          solver.inboxAddress,
          model as any,
        )
        expect(tx).toEqual(metaproverTx)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledTimes(1)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledWith(
          Number(model.intent.route.source),
          model.intent.reward.prover,
        )
        expect(proofService.isMetalayerProver).toHaveBeenCalledTimes(1)
        expect(proofService.isMetalayerProver).toHaveBeenCalledWith(
          Number(model.intent.route.source),
          model.intent.reward.prover,
        )
        expect(fulfillIntentService['getFulfillTxForMetalayer']).toHaveBeenCalledTimes(1)
      })
    })

    describe('on PROOF_HYPERLANE', () => {
      it('should use the correct function name and args', async () => {
        const mockHyperlane = jest.fn().mockReturnValue(true)
        proofService.isHyperlaneProver = mockHyperlane
        fulfillIntentService['getFulfillTxForHyperproverSingle'] = jest
          .fn()
          .mockReturnValue(emptyTxs[0])
        await fulfillIntentService['getFulfillIntentTx'](solver.inboxAddress, model as any)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledTimes(1)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledWith(
          Number(model.intent.route.source),
          model.intent.reward.prover,
        )
        expect(fulfillIntentService['getFulfillTxForHyperproverSingle']).toHaveBeenCalledTimes(1)
      })

      it('should use the correct function name and args for fulfillHyperInstantWithRelayer', async () => {
        const data = '0x9911'
        jest.spyOn(proofService, 'isMetalayerProver').mockReturnValue(false)
        jest.spyOn(proofService, 'isHyperlaneProver').mockReturnValue(true)
        jest.spyOn(ecoConfigService, 'getFulfill').mockReturnValue({ run: 'single' })
        mockEncodeFunctionData.mockReturnValue(data)
        fulfillIntentService['getFulfillment'] = jest
          .fn()
          .mockReturnValue('fulfillHyperInstantWithRelayer')
        defaultArgs.push(address1) // hyperProverAddr
        defaultArgs.push('0x9911') // messageData
        const hyperproverTx = { to: solver.inboxAddress, data, value: mockFee }
        fulfillIntentService['getFulfillTxForHyperproverSingle'] = jest
          .fn()
          .mockReturnValue(hyperproverTx)

        const tx = await fulfillIntentService['getFulfillIntentTx'](
          solver.inboxAddress,
          model as any,
        )
        expect(tx).toEqual(hyperproverTx)
        expect(proofService.isMetalayerProver).toHaveBeenCalledTimes(0)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledTimes(1)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledWith(
          Number(model.intent.route.source),
          model.intent.reward.prover,
        )
        expect(fulfillIntentService['getFulfillTxForHyperproverSingle']).toHaveBeenCalledTimes(1)
      })

      it('should use the correct function name and args for fulfillHyperBatched', async () => {
        const data = '0x9911'
        jest.spyOn(proofService, 'isMetalayerProver').mockReturnValue(false)
        jest.spyOn(proofService, 'isHyperlaneProver').mockReturnValue(true)
        mockEncodeFunctionData.mockReturnValue(data)
        fulfillIntentService['getFulfillment'] = jest.fn().mockReturnValue('fulfillHyperBatched')
        jest.spyOn(ecoConfigService, 'getFulfill').mockReturnValue({ run: 'batch' })

        const hyperproverTx = { to: solver.inboxAddress, data, value: mockFee }
        fulfillIntentService['getFulfillTxForHyperproverBatch'] = jest
          .fn()
          .mockReturnValue(hyperproverTx)
        defaultArgs.push(model.intent.reward.prover)
        const tx = await fulfillIntentService['getFulfillIntentTx'](
          solver.inboxAddress,
          model as any,
        )
        expect(tx).toEqual(hyperproverTx)
        expect(proofService.isMetalayerProver).toHaveBeenCalledTimes(0)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledTimes(1)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledWith(
          Number(model.intent.route.source),
          model.intent.reward.prover,
        )
        expect(fulfillIntentService['getFulfillTxForHyperproverBatch']).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('on getFulfillTxForHyperproverSingle', () => {
    beforeEach(() => {
      mockEncodeAbiParameters.mockClear()
      mockGetChainConfig.mockClear()
      mockEncodeFunctionData.mockClear()
    })
    it('should encode the contract data correctly', async () => {
      const model = {
        event: {
          sourceChainID: 10n,
        },
        intent: {
          hash: '0x1234',
          reward: {
            prover: address3,
          },
          route: {
            destination: 1n,
          },
        },
      } as any
      mockGetChainConfig.mockReturnValue({ HyperProver: address1 })
      const encodedData = '0x9911'
      mockEncodeAbiParameters.mockReturnValue(encodedData)
      const mockProverFee = jest.fn().mockReturnValue(0n)
      fulfillIntentService['getProverFee'] = mockProverFee
      RewardDataModel.getHash = jest.fn().mockReturnValue('0x123abc')
      IntentDataModel.getHash = jest.fn().mockReturnValue('0x123abc')
      await fulfillIntentService['getFulfillTxForHyperproverSingle'](address1, address2, model)

      expect(mockEncodeAbiParameters).toHaveBeenCalledTimes(1)
      expect(mockProverFee).toHaveBeenCalledTimes(1)
      expect(mockEncodeAbiParameters).toHaveBeenCalledWith(
        [{ type: 'bytes32' }, { type: 'bytes' }, { type: 'address' }],
        [pad(model.intent.reward.prover), '0x', zeroAddress],
      )
      expect(mockProverFee).toHaveBeenCalledWith(model, address2, address1, encodedData)
    })
  })

  describe('on getFulfillTxForMetalayer', () => {
    beforeEach(() => {
      mockEncodeAbiParameters.mockClear()
      mockGetChainConfig.mockClear()
      mockEncodeFunctionData.mockClear()
    })
    it('should encode the contract data correctly', async () => {
      const model = {
        event: {
          sourceChainID: 10n,
        },
        intent: {
          hash: '0x1234',
          reward: {
            prover: address3,
          },
          route: {
            source: 10n,
            destination: 1n,
          },
        },
      } as any
      mockGetChainConfig.mockReturnValue({ MetaProver: address1 })
      const encodedData = '0x9911'
      mockEncodeAbiParameters.mockReturnValue(encodedData)
      const mockProverFee = jest.fn().mockReturnValue(0n)
      fulfillIntentService['getProverFee'] = mockProverFee
      RewardDataModel.getHash = jest.fn().mockReturnValue('0x123abc')
      IntentDataModel.getHash = jest.fn().mockReturnValue('0x123abc')
      await fulfillIntentService['getFulfillTxForMetalayer'](address1, address2, model)

      expect(mockEncodeAbiParameters).toHaveBeenCalledTimes(1)
      expect(mockProverFee).toHaveBeenCalledTimes(1)
      expect(mockEncodeAbiParameters).toHaveBeenCalledWith(
        [{ type: 'bytes32' }],
        [pad(model.intent.reward.prover)],
      )
      expect(mockProverFee).toHaveBeenCalledWith(model, address2, address1, encodedData)
    })
  })
})
