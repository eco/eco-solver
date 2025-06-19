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
import { WithdrawalRepository } from '../repositories/withdrawal.repository'
import { Types } from 'mongoose'

describe('WithdrawalService', () => {
  let service: WithdrawalService
  let intentModel: DeepMocked<Model<IntentSourceModel>>
  let utilsIntentService: DeepMocked<UtilsIntentService>
  let withdrawalRepository: DeepMocked<WithdrawalRepository>

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

  const mockIntentModel = {
    _id: new Types.ObjectId(),
    intent: {
      hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as Hex,
    } as any,
    status: 'SOLVED',
    receipt: {
      transactionHash: '0xoriginal123',
    } as any,
  } as any

  const mockWithdrawalRecord = {
    _id: new Types.ObjectId(),
    event: {
      sourceChainID: BigInt(1),
      sourceNetwork: Network.ETH_MAINNET,
      blockNumber: BigInt(12345678),
      blockHash: mockWithdrawalEvent.blockHash,
      transactionIndex: mockWithdrawalEvent.transactionIndex,
      removed: mockWithdrawalEvent.removed,
      address: mockWithdrawalEvent.address,
      data: mockWithdrawalEvent.data,
      topics: mockWithdrawalEvent.topics,
      transactionHash: mockWithdrawalEvent.transactionHash,
      logIndex: mockWithdrawalEvent.logIndex,
    },
    intentHash: mockWithdrawalEvent.args.hash,
    intentId: mockIntentModel._id,
    recipient: mockWithdrawalEvent.args.recipient,
    processedAt: new Date(),
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
        {
          provide: WithdrawalRepository,
          useValue: createMock<WithdrawalRepository>(),
        },
      ],
    }).compile()

    service = module.get<WithdrawalService>(WithdrawalService)
    intentModel = module.get(getModelToken(IntentSourceModel.name))
    utilsIntentService = module.get(UtilsIntentService)
    withdrawalRepository = module.get(WithdrawalRepository)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('processWithdrawal', () => {
    describe('successful processing', () => {
      beforeEach(() => {
        withdrawalRepository.exists.mockResolvedValue(false)
        withdrawalRepository.create.mockResolvedValue(mockWithdrawalRecord as any)
        intentModel.findOne.mockResolvedValue(mockIntentModel as any)
        utilsIntentService.updateIntentModel.mockResolvedValue({} as any)
      })

      it('should process withdrawal event and update intent status to WITHDRAWN', async () => {
        await service.processWithdrawal(mockWithdrawalEvent)

        expect(withdrawalRepository.exists).toHaveBeenCalledWith(mockWithdrawalEvent.args.hash)

        expect(intentModel.findOne).toHaveBeenCalledWith({
          'intent.hash': mockWithdrawalEvent.args.hash,
        })

        expect(withdrawalRepository.create).toHaveBeenCalledWith({
          event: {
            sourceChainID: BigInt('0x1'),
            sourceNetwork: Network.ETH_MAINNET,
            blockNumber: BigInt('0xbc614e'),
            blockHash: mockWithdrawalEvent.blockHash,
            transactionIndex: mockWithdrawalEvent.transactionIndex,
            removed: mockWithdrawalEvent.removed,
            address: mockWithdrawalEvent.address,
            data: mockWithdrawalEvent.data,
            topics: mockWithdrawalEvent.topics,
            transactionHash: mockWithdrawalEvent.transactionHash,
            logIndex: mockWithdrawalEvent.logIndex,
          },
          intentHash: mockWithdrawalEvent.args.hash,
          intentId: mockIntentModel._id,
          recipient: mockWithdrawalEvent.args.recipient,
        })

        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...mockIntentModel,
          status: 'WITHDRAWN',
          withdrawalId: mockWithdrawalRecord._id,
        })
      })

      it('should set withdrawalId on the intent', async () => {
        await service.processWithdrawal(mockWithdrawalEvent)

        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...mockIntentModel,
          status: 'WITHDRAWN',
          withdrawalId: mockWithdrawalRecord._id,
        })
      })

      it('should handle intents with no existing receipt', async () => {
        const modelWithNoReceipt = {
          ...mockIntentModel,
          receipt: undefined,
        }
        intentModel.findOne.mockResolvedValue(modelWithNoReceipt as any)

        await service.processWithdrawal(mockWithdrawalEvent)

        expect(withdrawalRepository.create).toHaveBeenCalled()
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalledWith({
          ...modelWithNoReceipt,
          status: 'WITHDRAWN',
          withdrawalId: mockWithdrawalRecord._id,
        })
      })

      it('should skip processing if withdrawal already exists', async () => {
        withdrawalRepository.exists.mockResolvedValue(true)

        await service.processWithdrawal(mockWithdrawalEvent)

        expect(withdrawalRepository.exists).toHaveBeenCalledWith(mockWithdrawalEvent.args.hash)
        expect(intentModel.findOne).not.toHaveBeenCalled()
        expect(withdrawalRepository.create).not.toHaveBeenCalled()
        expect(utilsIntentService.updateIntentModel).not.toHaveBeenCalled()
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

        expect(withdrawalRepository.exists).not.toHaveBeenCalled()
        expect(intentModel.findOne).not.toHaveBeenCalled()
        expect(withdrawalRepository.create).not.toHaveBeenCalled()
        expect(utilsIntentService.updateIntentModel).not.toHaveBeenCalled()
      })

      it('should handle intent not found gracefully', async () => {
        withdrawalRepository.exists.mockResolvedValue(false)
        intentModel.findOne.mockResolvedValue(null)

        await service.processWithdrawal(mockWithdrawalEvent)

        expect(withdrawalRepository.exists).toHaveBeenCalled()
        expect(intentModel.findOne).toHaveBeenCalledWith({
          'intent.hash': mockWithdrawalEvent.args.hash,
        })
        expect(withdrawalRepository.create).not.toHaveBeenCalled()
        expect(utilsIntentService.updateIntentModel).not.toHaveBeenCalled()
      })

      it('should handle database errors during intent lookup', async () => {
        const dbError = new Error('Database connection failed')
        withdrawalRepository.exists.mockResolvedValue(false)
        intentModel.findOne.mockRejectedValue(dbError)

        await expect(service.processWithdrawal(mockWithdrawalEvent)).rejects.toThrow(dbError)

        expect(withdrawalRepository.exists).toHaveBeenCalled()
        expect(intentModel.findOne).toHaveBeenCalledWith({
          'intent.hash': mockWithdrawalEvent.args.hash,
        })
        expect(withdrawalRepository.create).not.toHaveBeenCalled()
        expect(utilsIntentService.updateIntentModel).not.toHaveBeenCalled()
      })

      it('should handle database errors during intent update', async () => {
        const dbError = new Error('Update failed')
        withdrawalRepository.exists.mockResolvedValue(false)
        withdrawalRepository.create.mockResolvedValue(mockWithdrawalRecord as any)
        intentModel.findOne.mockResolvedValue(mockIntentModel as any)
        utilsIntentService.updateIntentModel.mockRejectedValue(dbError)

        await expect(service.processWithdrawal(mockWithdrawalEvent)).rejects.toThrow(dbError)

        expect(withdrawalRepository.exists).toHaveBeenCalled()
        expect(intentModel.findOne).toHaveBeenCalledWith({
          'intent.hash': mockWithdrawalEvent.args.hash,
        })
        expect(withdrawalRepository.create).toHaveBeenCalled()
        expect(utilsIntentService.updateIntentModel).toHaveBeenCalled()
      })
    })

    describe('data integrity', () => {
      beforeEach(() => {
        withdrawalRepository.exists.mockResolvedValue(false)
        withdrawalRepository.create.mockResolvedValue(mockWithdrawalRecord as any)
        intentModel.findOne.mockResolvedValue(mockIntentModel as any)
        utilsIntentService.updateIntentModel.mockResolvedValue({} as any)
      })

      it('should correctly set withdrawalId and status on intent', async () => {
        await service.processWithdrawal(mockWithdrawalEvent)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]

        expect(updateCall.status).toBe('WITHDRAWN')
        expect(updateCall.withdrawalId).toBe(mockWithdrawalRecord._id)
      })

      it('should create withdrawal record with correct recipient', async () => {
        const customRecipient = '0x9999999999999999999999999999999999999999' as Hex
        const eventWithCustomRecipient = {
          ...mockWithdrawalEvent,
          args: {
            ...mockWithdrawalEvent.args,
            recipient: customRecipient,
          },
        }

        await service.processWithdrawal(eventWithCustomRecipient)

        expect(withdrawalRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            recipient: customRecipient,
          }),
        )
      })

      it('should create withdrawal record with correct transaction hash', async () => {
        const customTxHash =
          '0x8888888888888888888888888888888888888888888888888888888888888888' as Hex
        const eventWithCustomTxHash = {
          ...mockWithdrawalEvent,
          transactionHash: customTxHash,
        }

        await service.processWithdrawal(eventWithCustomTxHash)

        expect(withdrawalRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            event: expect.objectContaining({
              transactionHash: customTxHash,
            }),
          }),
        )
      })
    })

    describe('various intent statuses', () => {
      beforeEach(() => {
        withdrawalRepository.exists.mockResolvedValue(false)
        withdrawalRepository.create.mockResolvedValue(mockWithdrawalRecord as any)
        utilsIntentService.updateIntentModel.mockResolvedValue({} as any)
      })

      it('should handle withdrawal from SOLVED intent', async () => {
        const solvedIntent = { ...mockIntentModel, status: 'SOLVED' as const }
        intentModel.findOne.mockResolvedValue(solvedIntent as any)

        await service.processWithdrawal(mockWithdrawalEvent)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]
        expect(updateCall.status).toBe('WITHDRAWN')
      })

      it('should handle withdrawal from CL_SOLVED intent', async () => {
        const clSolvedIntent = { ...mockIntentModel, status: 'CL_SOLVED' as const }
        intentModel.findOne.mockResolvedValue(clSolvedIntent as any)

        await service.processWithdrawal(mockWithdrawalEvent)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]
        expect(updateCall.status).toBe('WITHDRAWN')
      })

      it('should handle withdrawal from any other status', async () => {
        const pendingIntent = { ...mockIntentModel, status: 'PENDING' as const }
        intentModel.findOne.mockResolvedValue(pendingIntent as any)

        await service.processWithdrawal(mockWithdrawalEvent)

        const updateCall = utilsIntentService.updateIntentModel.mock.calls[0][0]
        expect(updateCall.status).toBe('WITHDRAWN')
      })
    })
  })

  describe('getWithdrawalsByRecipient', () => {
    it('should call repository findByRecipient method', async () => {
      const recipient = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef' as Hex
      const mockWithdrawals = [mockWithdrawalRecord]
      withdrawalRepository.findByRecipient.mockResolvedValue(mockWithdrawals as any)

      const result = await service.getWithdrawalsByRecipient(recipient)

      expect(withdrawalRepository.findByRecipient).toHaveBeenCalledWith(recipient)
      expect(result).toEqual(mockWithdrawals)
    })
  })

  describe('getWithdrawalsByIntentHash', () => {
    it('should call repository findByIntentHash method', async () => {
      const intentHash = mockWithdrawalEvent.args.hash
      const mockWithdrawals = [mockWithdrawalRecord]
      withdrawalRepository.findByIntentHash.mockResolvedValue(mockWithdrawals as any)

      const result = await service.getWithdrawalsByIntentHash(intentHash)

      expect(withdrawalRepository.findByIntentHash).toHaveBeenCalledWith(intentHash)
      expect(result).toEqual(mockWithdrawals)
    })
  })

  describe('getWithdrawalStats', () => {
    it('should call repository getStatsByRecipient method', async () => {
      const recipient = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef' as Hex
      const mockStats = {
        totalWithdrawals: 5,
        uniqueIntents: 3,
        latestWithdrawal: new Date(),
      }
      withdrawalRepository.getStatsByRecipient.mockResolvedValue(mockStats)

      const result = await service.getWithdrawalStats(recipient)

      expect(withdrawalRepository.getStatsByRecipient).toHaveBeenCalledWith(recipient)
      expect(result).toEqual(mockStats)
    })
  })
})
