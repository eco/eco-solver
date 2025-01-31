const mockEncodeFunctionData = jest.fn()

import { Test, TestingModule } from '@nestjs/testing'
import { Hex, zeroAddress } from 'viem'
import { getModelToken } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { InboxAbi } from '@eco-foundation/routes-ts'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { ProofService } from '@/prover/proof.service'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { UtilsIntentService } from '../utils-intent.service'
import { FulfillIntentService } from '../fulfill-intent.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'

jest.mock('viem', () => {
  return {
    ...jest.requireActual('viem'),
    encodeFunctionData: mockEncodeFunctionData,
  }
})

describe('FulfillIntentService', () => {
  const address1 = '0x1111111111111111111111111111111111111111'
  const address2 = '0x2222222222222222222222222222222222222222'

  let fulfillIntentService: FulfillIntentService
  let accountClientService: DeepMocked<KernelAccountClientService>
  let proofService: DeepMocked<ProofService>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let ecoConfigService: DeepMocked<EcoConfigService>
  let intentModel: DeepMocked<Model<IntentSourceModel>>

  const mockLogDebug = jest.fn()
  const mockLogLog = jest.fn()
  const mockLogError = jest.fn()

  beforeEach(async () => {
    const chainMod: TestingModule = await Test.createTestingModule({
      providers: [
        FulfillIntentService,
        { provide: KernelAccountClientService, useValue: createMock<KernelAccountClientService>() },
        { provide: ProofService, useValue: createMock<ProofService>() },
        { provide: UtilsIntentService, useValue: createMock<UtilsIntentService>() },
        { provide: EcoConfigService, useValue: createMock<EcoConfigService>() },
        {
          provide: getModelToken(IntentSourceModel.name),
          useValue: createMock<Model<IntentSourceModel>>(),
        },
      ],
    }).compile()

    fulfillIntentService = chainMod.get(FulfillIntentService)
    accountClientService = chainMod.get(KernelAccountClientService)
    proofService = chainMod.get(ProofService)
    utilsIntentService = chainMod.get(UtilsIntentService)
    ecoConfigService = chainMod.get(EcoConfigService)
    intentModel = chainMod.get(getModelToken(IntentSourceModel.name))

    fulfillIntentService['logger'].debug = mockLogDebug
    fulfillIntentService['logger'].log = mockLogLog
    fulfillIntentService['logger'].error = mockLogError

    // make sure it returns something real
    fulfillIntentService['getHyperlaneFee'] = jest.fn().mockReturnValue(0n)
  })
  const hash = address1
  const claimant = address2
  const solver = { inboxAddress: address1, chainID: 1 }
  const model = {
    intent: {
      route: { hash, destination: 85432, getHash: () => '0x6543' },
      reward: { getHash: () => '0x123abc' },
      getHash: () => {
        return { intentHash: '0xaaaa999' }
      },
    },
    event: { sourceChainID: 11111 },
  }
  const emptyTxs = [{ data: undefined, to: hash, value: 0n }]
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

  describe('on executeFulfillIntent', () => {
    describe('on setup', () => {
      it('should throw if data can`t be destructured', async () => {
        //when error
        const error = new Error('stuff went bad')
        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ err: error })
        await expect(() => fulfillIntentService.executeFulfillIntent(hash)).rejects.toThrow(error)
      })

      it('should set the claimant for the fulfill', async () => {
        jest.spyOn(accountClientService, 'getClient').mockImplementation((): any =>
          Promise.resolve({
            execute: jest.fn().mockResolvedValue(hash),
            waitForTransactionReceipt: jest.fn().mockResolvedValue({ transactionHash: hash }),
          }),
        )

        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ model, solver })
        const mockGetFulfillIntentTx = jest.fn()
        fulfillIntentService['getFulfillIntentTx'] = mockGetFulfillIntentTx
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        expect(await fulfillIntentService.executeFulfillIntent(hash)).toBeUndefined()
        expect(mockGetFulfillIntentTx).toHaveBeenCalledWith(solver.inboxAddress, model)
      })
    })

    describe('on failed execution', () => {
      it('should bubble up the thrown error', async () => {
        const error = new Error('stuff went bad')
        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ model, solver })
        fulfillIntentService['getFulfillIntentData'] = jest.fn()
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        jest.spyOn(accountClientService, 'getClient').mockImplementation(async () => {
          return {
            execute: () => {
              throw error
            },
          } as any
        })
        await expect(() => fulfillIntentService.executeFulfillIntent(hash)).rejects.toThrow(error)
      })

      it('should fail on receipt status reverted', async () => {
        const receipt = { status: 'reverted' }
        const error = EcoError.FulfillIntentRevertError(receipt as any)
        utilsIntentService.getIntentProcessData = jest.fn().mockResolvedValue({ model, solver })
        fulfillIntentService['getFulfillIntentData'] = jest.fn()
        fulfillIntentService['getTransactionsForTargets'] = jest.fn().mockReturnValue([])
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
        await expect(() => fulfillIntentService.executeFulfillIntent(hash)).rejects.toThrow(error)
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
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        jest.spyOn(accountClientService, 'getClient').mockImplementation(async () => {
          return {
            execute: () => {
              throw error
            },
          } as any
        })
        await expect(() => fulfillIntentService.executeFulfillIntent(hash)).rejects.toThrow(error)
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
        jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
        jest.spyOn(accountClientService, 'getClient').mockImplementation(async () => {
          return {
            execute: () => {
              throw error
            },
          } as any
        })
        await expect(() => fulfillIntentService.executeFulfillIntent(hash)).rejects.toThrow(error)
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

        await expect(() => fulfillIntentService.executeFulfillIntent(hash)).rejects.toThrow(error2)
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

        expect(await fulfillIntentService.executeFulfillIntent(hash)).resolves
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
        expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith({ hash: transactionHash })
      })

      it('should log', async () => {
        expect(mockLogDebug).toHaveBeenCalledTimes(2)
        expect(mockLogDebug).toHaveBeenNthCalledWith(2, {
          msg: `Fulfilled transactionHash ${transactionHash}`,
          userOPHash: { transactionHash },
          destinationChainID: model.intent.route.destination,
          sourceChainID: model.event.sourceChainID,
        })
      })

      it('should update the db model with status and receipt', async () => {
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledTimes(1)
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...model,
          status: 'SOLVED',
          receipt: { transactionHash },
        })
      })
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
    it('should return the transfer selector with data correctly encoded', async () => {
      const transferFunctionData = '0x9911'
      mockEncodeFunctionData.mockReturnValue(transferFunctionData)
      expect(
        fulfillIntentService.handleErc20(
          { selector, decodedFunctionData: { args: [, amount] } } as any,
          { inboxAddress } as any,
          target,
        ),
      ).toEqual([{ to: target, data: transferFunctionData }])
      expect(mockEncodeFunctionData).toHaveBeenCalledWith({
        abi: expect.anything(),
        functionName: 'transfer',
        args: [inboxAddress, amount],
      })
    })
  })

  describe('on getTransactionsForTargets', () => {
    const model = { intent: { route: { calls: [{ target: address1, data: address2 }] } } }
    const tt = { targetConfig: { contractType: 'erc20' } }
    it('should return empty if input is invalid', async () => {
      expect(fulfillIntentService['getTransactionsForTargets']({} as any)).toEqual([])
      expect(fulfillIntentService['getTransactionsForTargets']({ model: { a: 1 } } as any)).toEqual(
        [],
      )
      expect(
        fulfillIntentService['getTransactionsForTargets']({ solver: { b: 2 } } as any),
      ).toEqual([])
    })

    it('should return empty if no targets', async () => {
      expect(
        fulfillIntentService['getTransactionsForTargets']({
          model: { intent: { targets: [] } },
        } as any),
      ).toEqual([])
    })

    it('should return empty item for invalid transaction target data', async () => {
      utilsIntentService.getTransactionTargetData = jest.fn().mockReturnValue(null)
      expect(fulfillIntentService['getTransactionsForTargets']({ model, solver } as any)).toEqual(
        [],
      )
      expect(utilsIntentService.getTransactionTargetData).toHaveBeenCalledWith(
        model.intent,
        solver,
        model.intent.route.calls[0],
      )
      expect(mockLogError).toHaveBeenCalledTimes(1)
      expect(mockLogError).toHaveBeenCalledWith({
        msg: `fulfillIntent: Invalid transaction data`,
        error: EcoError.FulfillIntentNoTransactionError.toString(),
        model,
      })
    })

    it('should return empty for erc721, erc1155, or anything other than erc20', async () => {
      //erc721
      utilsIntentService.getTransactionTargetData = jest
        .fn()
        .mockReturnValue({ targetConfig: { contractType: 'erc721' } })
      expect(fulfillIntentService['getTransactionsForTargets']({ model, solver } as any)).toEqual(
        [],
      )

      //erc1155
      utilsIntentService.getTransactionTargetData = jest
        .fn()
        .mockReturnValue({ targetConfig: { contractType: 'erc1155' } })
      expect(fulfillIntentService['getTransactionsForTargets']({ model, solver } as any)).toEqual(
        [],
      )

      //default/catch-all
      utilsIntentService.getTransactionTargetData = jest
        .fn()
        .mockReturnValue({ targetConfig: { contractType: 'face' } })
      expect(fulfillIntentService['getTransactionsForTargets']({ model, solver } as any)).toEqual(
        [],
      )
    })

    it('should return correct data for erc20', async () => {
      const mockHandleErc20Data = [{ to: address1, data: address2 }]
      utilsIntentService.getTransactionTargetData = jest.fn().mockReturnValue(tt)
      fulfillIntentService.handleErc20 = jest.fn().mockReturnValue(mockHandleErc20Data)
      expect(fulfillIntentService['getTransactionsForTargets']({ model, solver } as any)).toEqual(
        mockHandleErc20Data,
      )
    })

    it('should process multiple targets', async () => {
      const model = {
        intent: {
          route: {
            calls: [
              { target: address1, data: '0x3' },
              { target: address2, data: '0x4' },
            ],
          },
        },
      }
      const mockHandleErc20Data = [
        { to: '0x11', data: '0x22' },
        { to: '0x33', data: '0x44' },
      ]
      utilsIntentService.getTransactionTargetData = jest.fn().mockReturnValue(tt)
      fulfillIntentService.handleErc20 = jest.fn().mockImplementation((tt, solver, target) => {
        if (target === model.intent.route.calls[0].target) return mockHandleErc20Data[0]
        if (target === model.intent.route.calls[1].target) return mockHandleErc20Data[1]
      })
      expect(fulfillIntentService['getTransactionsForTargets']({ model, solver } as any)).toEqual(
        mockHandleErc20Data,
      )
    })
  })

  describe('on getFulfillIntentTx', () => {
    const model = {
      intent: {
        hash: '0x1234',
        route: {
          calls: [{ target: address1, data: address2 }],
          deadline: '0x2233',
          salt: '0x3344',
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

    beforeEach(() => {
      jest.spyOn(ecoConfigService, 'getEth').mockReturnValue({ claimant } as any)
      defaultArgs = [
        model.intent.route,
        model.intent.reward.getHash(),
        claimant,
        model.intent.getHash().intentHash,
      ]
    })
    describe('on PROOF_STORAGE', () => {
      it('should use the correct function name and args', async () => {
        const mockStorage = jest.fn().mockReturnValue(true)
        const mockHyperlane = jest.fn().mockReturnValue(false)
        proofService.isStorageProver = mockStorage
        proofService.isHyperlaneProver = mockHyperlane
        await fulfillIntentService['getFulfillIntentTx'](solver.inboxAddress, model as any)
        expect(proofService.isStorageProver).toHaveBeenCalledTimes(1)
        expect(proofService.isStorageProver).toHaveBeenCalledWith(model.intent.reward.prover)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledTimes(1)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledWith(model.intent.reward.prover)
        expect(mockEncodeFunctionData).toHaveBeenCalledWith({
          abi: InboxAbi,
          functionName: 'fulfillStorage',
          args: defaultArgs,
        })
      })
    })

    describe('on PROOF_HYPERLANE', () => {
      it('should use the correct function name and args for fulfillHyperInstantWithRelayer', async () => {
        const mockStorage = jest.fn().mockReturnValue(false)
        const mockHyperlane = jest.fn().mockReturnValue(true)
        proofService.isStorageProver = mockStorage
        proofService.isHyperlaneProver = mockHyperlane
        defaultArgs.push(model.intent.reward.prover)
        defaultArgs.push('0x0')
        defaultArgs.push(zeroAddress)
        await fulfillIntentService['getFulfillIntentTx'](solver.inboxAddress, model as any)
        expect(proofService.isStorageProver).toHaveBeenCalledTimes(1)
        expect(proofService.isStorageProver).toHaveBeenCalledWith(model.intent.reward.prover)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledTimes(1)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledWith(model.intent.reward.prover)
        expect(mockEncodeFunctionData).toHaveBeenCalledTimes(1)
        expect(mockEncodeFunctionData).toHaveBeenCalledWith({
          abi: InboxAbi,
          functionName: 'fulfillHyperInstantWithRelayer',
          args: defaultArgs,
        })
      })

      it('should use the correct function name and args for fulfillHyperBatched', async () => {
        const mockStorage = jest.fn().mockReturnValue(false)
        const mockHyperlane = jest.fn().mockReturnValue(true)
        proofService.isStorageProver = mockStorage
        proofService.isHyperlaneProver = mockHyperlane
        fulfillIntentService['getFulfillment'] = jest.fn().mockReturnValue('fulfillHyperBatched')
        defaultArgs.push(model.intent.reward.prover)
        await fulfillIntentService['getFulfillIntentTx'](solver.inboxAddress, model as any)
        expect(proofService.isStorageProver).toHaveBeenCalledTimes(1)
        expect(proofService.isStorageProver).toHaveBeenCalledWith(model.intent.reward.prover)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledTimes(1)
        expect(proofService.isHyperlaneProver).toHaveBeenCalledWith(model.intent.reward.prover)
        expect(mockEncodeFunctionData).toHaveBeenCalledTimes(1)
        expect(mockEncodeFunctionData).toHaveBeenCalledWith({
          abi: InboxAbi,
          functionName: 'fulfillHyperBatched',
          args: defaultArgs,
        })
      })
    })
  })
})
