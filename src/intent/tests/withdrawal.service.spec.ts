import { Test, TestingModule } from '@nestjs/testing'
import { createMock, DeepMocked } from '@golevelup/ts-jest'
import { Model } from 'mongoose'
import { getModelToken } from '@nestjs/mongoose'
import { Hex } from 'viem'

import { WithdrawalService } from '../withdrawal.service'
import { IntentSourceModel } from '../schemas/intent-source.schema'
import { UtilsIntentService } from '../utils-intent.service'
import { WithdrawalLog } from '@/contracts/intent-source'
import { Serialize } from '@/common/utils/serialize'
import { Network } from '@/common/alchemy/network'

describe('WithdrawalService', () => {
  let service: WithdrawalService
  let intentModel: DeepMocked<Model<IntentSourceModel>>
  let utilsIntentService: DeepMocked<UtilsIntentService>

  const mockWithdrawalEvent: Serialize<WithdrawalLog> = {
    args: {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
      recipient: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef' as Hex,
    },
    eventName: 'Withdrawal',
    logIndex: 42,
    transactionHash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as Hex,
    address: '0x1111111111111111111111111111111111111111' as Hex,
    blockHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex,
    blockNumber: { type: 'BigInt', hex: '0xbc614e' },
    data: '0x',
    topics: [
      '0x3333333333333333333333333333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444444444444444444444444444',
    ] as [`0x${string}`, `0x${string}`],
    transactionIndex: 1,
    removed: false,
    sourceChainID: { type: 'BigInt', hex: '0x1' },
    sourceNetwork: Network.ETH_MAINNET,
  }

  const mockIntentModel: Partial<IntentSourceModel> = {
    intent: {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
    } as any,
    status: 'SOLVED',
    receipt: {
      transactionHash: '0xoriginal123',
    } as any,
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalService,
        {
          provide: getModelToken(IntentSourceModel.name),
          useValue: createMock<Model<IntentSourceModel>>(),
        },
        {
          provide: UtilsIntentService,
          useValue: createMock<UtilsIntentService>(),
        },
      ],
    }).compile()

    service = module.get<WithdrawalService>(WithdrawalService)
    intentModel = module.get(getModelToken(IntentSourceModel.name))
    utilsIntentService = module.get(UtilsIntentService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('processWithdrawal', () => {
    describe('successful processing', () => {
      beforeEach(() => {
        intentModel.findOne.mockResolvedValue(mockIntentModel as any)
        utilsIntentService.updateIntentModel.mockResolvedValue({} as any)
      })

      it('should process withdrawal event and update intent status to WITHDRAWN', async () => {
        await service.processWithdrawal(mockWithdrawalEvent)

        expect(intentModel.findOne).toHaveBeenCalledWith({
          'intent.hash': mockWithdrawalEvent.args.hash,
        })

        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...mockIntentModel,
          status: 'WITHDRAWN',
          receipt: {
            transactionHash: '0xoriginal123',
            withdrawalHash: mockWithdrawalEvent.transactionHash,
            withdrawalRecipient: mockWithdrawalEvent.args.recipient,
            withdrawalLogIndex: mockWithdrawalEvent.logIndex,
          },
        })
      })

      it('should preserve existing receipt data when adding withdrawal info', async () => {
        const modelWithComplexReceipt = {
          ...mockIntentModel,
          receipt: {
            transactionHash: '0xoriginal123',
            otherData: 'should be preserved',
            nested: {
              field: 'also preserved',
            },
          },
        }
        intentModel.findOne.mockResolvedValue(modelWithComplexReceipt as any)

        await service.processWithdrawal(mockWithdrawalEvent)

        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...modelWithComplexReceipt,
          status: 'WITHDRAWN',
          receipt: {
            transactionHash: '0xoriginal123',
            otherData: 'should be preserved',
            nested: {
              field: 'also preserved',
            },
            withdrawalHash: mockWithdrawalEvent.transactionHash,
            withdrawalRecipient: mockWithdrawalEvent.args.recipient,
            withdrawalLogIndex: mockWithdrawalEvent.logIndex,
          },
        })
      })

      it('should handle intents with no existing receipt', async () => {
        const modelWithNoReceipt = {
          ...mockIntentModel,
          receipt: undefined,
        }
        intentModel.findOne.mockResolvedValue(modelWithNoReceipt as any)

        await service.processWithdrawal(mockWithdrawalEvent)

        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...modelWithNoReceipt,
          status: 'WITHDRAWN',
          receipt: {
            withdrawalHash: mockWithdrawalEvent.transactionHash,
            withdrawalRecipient: mockWithdrawalEvent.args.recipient,
            withdrawalLogIndex: mockWithdrawalEvent.logIndex,
          },
        })
      })
    })

    describe('error handling', () => {
      it('should handle withdrawal event with missing hash', async () => {
        const invalidEvent = {
          ...mockWithdrawalEvent,
          args: {
            recipient: mockWithdrawalEvent.args.recipient,
          },
        } as any

        await service.processWithdrawal(invalidEvent)

        expect(intentModel.findOne).not.toHaveBeenCalled()
        expect(utilsIntentService.updateIntentModel).not.toHaveBeenCalled()
      })

      it('should handle intent not found gracefully', async () => {
        intentModel.findOne.mockResolvedValue(null)

        await service.processWithdrawal(mockWithdrawalEvent)

        expect(intentModel.findOne).toHaveBeenCalledWith({
          'intent.hash': mockWithdrawalEvent.args.hash,
        })
        expect(utilsIntentService.updateIntentModel).not.toHaveBeenCalled()
      })

      it('should handle database errors during intent lookup', async () => {
        const dbError = new Error('Database connection failed')
        intentModel.findOne.mockRejectedValue(dbError)

        await expect(service.processWithdrawal(mockWithdrawalEvent)).rejects.toThrow(dbError)

        expect(intentModel.findOne).toHaveBeenCalledWith({
          'intent.hash': mockWithdrawalEvent.args.hash,
        })
        expect(utilsIntentService.updateIntentModel).not.toHaveBeenCalled()
      })

      it('should handle database errors during intent update', async () => {
        const dbError = new Error('Update failed')
        intentModel.findOne.mockResolvedValue(mockIntentModel as any)
        utilsIntentService.updateIntentModel.mockRejectedValue(dbError)

        await expect(service.processWithdrawal(mockWithdrawalEvent)).rejects.toThrow(dbError)

        expect(intentModel.findOne).toHaveBeenCalledWith({
          'intent.hash': mockWithdrawalEvent.args.hash,
        })
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalled()
      })
    })

    describe('data integrity', () => {
      beforeEach(() => {
        intentModel.findOne.mockResolvedValue(mockIntentModel as any)
        utilsIntentService.updateIntentModel.mockResolvedValue({} as any)
      })

      it('should correctly map all withdrawal event fields to receipt', async () => {
        await service.processWithdrawal(mockWithdrawalEvent)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]

        expect(updateCall.status).toBe('WITHDRAWN')
        expect((updateCall.receipt as any).withdrawalHash).toBe(mockWithdrawalEvent.transactionHash)
        expect((updateCall.receipt as any).withdrawalRecipient).toBe(
          mockWithdrawalEvent.args.recipient,
        )
        expect((updateCall.receipt as any).withdrawalLogIndex).toBe(mockWithdrawalEvent.logIndex)
      })

      it('should handle different recipient addresses correctly', async () => {
        const customRecipient = '0x9999999999999999999999999999999999999999' as Hex
        const eventWithCustomRecipient = {
          ...mockWithdrawalEvent,
          args: {
            ...mockWithdrawalEvent.args,
            recipient: customRecipient,
          },
        }

        await service.processWithdrawal(eventWithCustomRecipient)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]
        expect((updateCall.receipt as any).withdrawalRecipient).toBe(customRecipient)
      })

      it('should handle different transaction hashes correctly', async () => {
        const customTxHash =
          '0x8888888888888888888888888888888888888888888888888888888888888888' as Hex
        const eventWithCustomTxHash = {
          ...mockWithdrawalEvent,
          transactionHash: customTxHash,
        }

        await service.processWithdrawal(eventWithCustomTxHash)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]
        expect((updateCall.receipt as any).withdrawalHash).toBe(customTxHash)
      })
    })

    describe('various intent statuses', () => {
      it('should handle withdrawal from SOLVED intent', async () => {
        const solvedIntent = { ...mockIntentModel, status: 'SOLVED' as const }
        intentModel.findOne.mockResolvedValue(solvedIntent as any)
        utilsIntentService.updateIntentModel.mockResolvedValue({} as any)

        await service.processWithdrawal(mockWithdrawalEvent)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]
        expect(updateCall.status).toBe('WITHDRAWN')
      })

      it('should handle withdrawal from CL_SOLVED intent', async () => {
        const clSolvedIntent = { ...mockIntentModel, status: 'CL_SOLVED' as const }
        intentModel.findOne.mockResolvedValue(clSolvedIntent as any)
        utilsIntentService.updateIntentModel.mockResolvedValue({} as any)

        await service.processWithdrawal(mockWithdrawalEvent)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]
        expect(updateCall.status).toBe('WITHDRAWN')
      })

      it('should handle withdrawal from any other status', async () => {
        const pendingIntent = { ...mockIntentModel, status: 'PENDING' as const }
        intentModel.findOne.mockResolvedValue(pendingIntent as any)
        utilsIntentService.updateIntentModel.mockResolvedValue({} as any)

        await service.processWithdrawal(mockWithdrawalEvent)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]
        expect(updateCall.status).toBe('WITHDRAWN')
      })
    })
  })
})
