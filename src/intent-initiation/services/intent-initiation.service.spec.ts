import { CreateIntentService } from '@/intent/create-intent.service'
import { createMock } from '@golevelup/ts-jest'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'
import { FeeService } from '@/fee/fee.service'
import {
  FundForTransactionData,
  IntentInitiationService,
  PermitResult,
} from '@/intent-initiation/services/intent-initiation.service'
import { GaslessIntentRequestDTO } from '@/quote/dto/gasless-intent-request.dto'
import { getModelToken } from '@nestjs/mongoose'
import { GroupedIntentRepository } from '@/intent-initiation/repositories/grouped-intent.repository'
import { GroupedIntentSchema } from '@/intent-initiation/schemas/grouped-intent.schema'
import { Hex, TransactionReceipt } from 'viem'
import { IntentSourceRepository } from '@/intent/repositories/intent-source.repository'
import { IntentSourceSchema } from '@/intent/schemas/intent-source.schema'
import { IntentTestUtils } from '@/intent-initiation/test-utils/intent-test-utils'
import { InternalQuoteError } from '@/quote/errors'
import { Permit2Processor } from '@/common/permit/permit2-processor'
import { PermitProcessor } from '@/common/permit/permit-processor'
import { PermitValidationService } from '@/intent-initiation/permit-validation/permit-validation.service'
import { QuoteIntentModel } from '@/quote/schemas/quote-intent.schema'
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { SignerKmsService } from '@/sign/signer-kms.service'
import { ValidationService } from '@/intent/validation.sevice'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

let $: EcoTester
let service: IntentInitiationService
let quoteRepository: QuoteRepository
let walletClientService: WalletClientDefaultSignerService
let permitValidationService: PermitValidationService

const intentTestUtils = new IntentTestUtils()
const quoteTestUtils = new QuoteTestUtils()

jest.mock('@/eco-configs/utils', () => {
  return {
    ...jest.requireActual('@/eco-configs/utils'),
    getChainConfig: jest
      .fn()
      .mockReturnValue({ IntentSource: '0x0000000000000000000000000000000000000001' }),
  }
})

const getFundForTxsPerChain = (
  mockChainID: number,
  txs: ExecuteSmartWalletArg[],
): Map<number, FundForTransactionData[]> => {
  const fundForTxsPerChain = new Map<number, FundForTransactionData[]>()

  const fundForTxData = txs.map((tx) => ({
    quoteID: `quoteID`,
    tx,
  }))

  fundForTxsPerChain.set(mockChainID, fundForTxData)

  return fundForTxsPerChain
}

describe('IntentInitiationService', () => {
  const mockTx: ExecuteSmartWalletArg = {
    to: '0x8c182a808f75a29c0f02d4ba80ab236ab01c0ace',
    data: '0x123',
    value: 0n,
  }

  let kernelMock: jest.Mocked<WalletClientDefaultSignerService>

  const mockReceipt: TransactionReceipt = {
    transactionHash: '0xtx',
  } as unknown as TransactionReceipt

  beforeAll(async () => {
    kernelMock = createMock<WalletClientDefaultSignerService>({
      estimateGas: jest.fn().mockResolvedValue({
        response: {
          chainID: 1,
          gasEstimate: 100000n,
          gasPrice: 50000000000n,
          gasCost: 5000000000000n,
        },
      }),
    })

    const mockSource = {
      getConfig: () => ({
        'IntentSource.1': '0x0000000000000000000000000000000000000001',
        'Prover.1': '0x0000000000000000000000000000000000000002',
        'HyperProver.1': '0x0000000000000000000000000000000000000003',
        'Inbox.1': '0x0000000000000000000000000000000000000004',
        rpcs: {
          keys: {
            '0x1234': '0x1234',
          },
        },
        alchemy: {
          networks: [{ id: 1 }, { id: 137 }],
          apiKey: 'fake-alchemy-api-key',
        },
        eth: {
          pollingInterval: 1000,
        },
      }),
    }

    $ = EcoTester.setupTestFor(IntentInitiationService)
      .withProviders([
        PermitValidationService,
        GroupedIntentRepository,
        IntentSourceRepository,
        QuoteRepository,
        {
          provide: getModelToken(QuoteIntentModel.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: WalletClientDefaultSignerService,
          useValue: kernelMock,
        },
      ])
      .withMocks([FeeService, ValidationService, SignerKmsService, CreateIntentService])
      .withSchemas([
        ['GroupedIntent', GroupedIntentSchema],
        ['IntentSourceModel', IntentSourceSchema],
      ])

    $.overridingProvider(EcoConfigService).useFactory(() => {
      return new EcoConfigService([mockSource as any])
    })

    service = await $.init()
    quoteRepository = $.get(QuoteRepository)
    walletClientService = $.get(WalletClientDefaultSignerService)
    permitValidationService = $.get(PermitValidationService)
  })

  beforeEach(() => {
    jest.spyOn(permitValidationService, 'validatePermits').mockResolvedValue({})
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Intent Execution', () => {
    it('fails if quote not found', async () => {
      const gaslessIntentData = intentTestUtils.createGaslessIntentDataDTO(
        {
          usePermit: false,
          isBatchPermit2: false,
          token: '0x0000000000000000000000000000000000000001',
        },
        {
          chainID: 10,
        },
      )

      const { gaslessIntentRequest } = intentTestUtils.createGaslessIntentRequestDTO({
        gaslessIntentData,
        token: '0x0000000000000000000000000000000000000001',
      })

      jest
        .spyOn(quoteRepository, 'fetchQuoteIntentData')
        .mockResolvedValue({ error: EcoError.QuoteNotFound }) // simulate quote not found

      const { error } = await service.initiateGaslessIntent(gaslessIntentRequest)
      expect(error.message).toContain('Quote not found')
    })

    it('executes intent with permit2', async () => {
      const gaslessIntentData = intentTestUtils.createGaslessIntentDataDTO(
        {
          usePermit: false,
          isBatchPermit2: false,
          token: '0x0000000000000000000000000000000000000001',
        },
        {
          chainID: 10,
        },
      )

      const gaslessIntentRequestData = intentTestUtils.createGaslessIntentRequestDTO({
        gaslessIntentData,
        token: '0x0000000000000000000000000000000000000001',
      })

      const { gaslessIntentRequest } = gaslessIntentRequestData

      const permit2Tx = { ...mockTx, data: '0xpermit2' as Hex }

      jest.spyOn(Permit2Processor, 'generateTxs').mockReturnValue([permit2Tx])

      jest.spyOn(quoteRepository, 'fetchQuoteIntentData').mockResolvedValue({
        response: quoteTestUtils.asQuoteIntentModel(gaslessIntentRequestData),
      })

      jest.spyOn(walletClientService, 'getClient').mockResolvedValue({
        sendTransaction: jest.fn().mockResolvedValue('0xtx'),
        waitForTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
      } as any)

      const { response: gaslessIntentResponse, error } =
        await service.initiateGaslessIntent(gaslessIntentRequest)
      expect(error).toBeUndefined()
      const { successes, failures } = gaslessIntentResponse!
      expect(failures.length).toBe(0)
      expect(successes[0].transactionHash).toBe('0xtx')
    })

    it('executes intent with permit', async () => {
      const gaslessIntentData = intentTestUtils.createGaslessIntentDataDTO(
        {
          usePermit: false,
          isBatchPermit2: false,
          token: '0x0000000000000000000000000000000000000001',
        },
        {
          chainID: 10,
        },
      )

      const gaslessIntentRequestData = intentTestUtils.createGaslessIntentRequestDTO({
        gaslessIntentData,
        token: '0x0000000000000000000000000000000000000001',
      })

      const { gaslessIntentRequest } = gaslessIntentRequestData
      const permitTx = { ...mockTx, data: '0xpermit' as Hex }

      jest.spyOn(PermitProcessor, 'generateTxs').mockReturnValue({ response: [permitTx] })

      jest.spyOn(quoteRepository, 'fetchQuoteIntentData').mockResolvedValue({
        response: quoteTestUtils.asQuoteIntentModel(gaslessIntentRequestData),
      })

      jest.spyOn(walletClientService, 'getClient').mockResolvedValue({
        sendTransaction: jest.fn().mockResolvedValue('0xtx'),
        waitForTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
      } as any)

      const { response: gaslessIntentResponse, error } =
        await service.initiateGaslessIntent(gaslessIntentRequest)
      expect(error).toBeUndefined()
      const { successes, failures } = gaslessIntentResponse!
      expect(failures.length).toBe(0)
      expect(successes[0].transactionHash).toBe('0xtx')
    })
  })

  describe('Intent Gas Estimation', () => {
    it('should calculate gas quote correctly', async () => {
      const dto = new GaslessIntentRequestDTO()

      const txs: ExecuteSmartWalletArg[] = [
        { to: '0xabc123...', data: '0x00', value: 0n },
        { to: '0xdef456...', data: '0x01', value: 0n },
      ]

      const mockGasEstimate = 100_000n
      const mockGasPrice = 50_000_000_000n // 50 gwei
      const mockChainID = 5
      const fundForTxsPerChain = getFundForTxsPerChain(mockChainID, txs)

      jest.spyOn(service, 'generateGaslessIntentTransactions').mockResolvedValue({
        response: {
          permitDataPerChain: new Map<number, PermitResult>(),
          fundForTxsPerChain,
        },
      })

      kernelMock.estimateGas.mockResolvedValue({
        response: {
          chainID: mockChainID,
          gasEstimate: mockGasEstimate,
          gasPrice: mockGasPrice,
          gasCost: mockGasEstimate * mockGasPrice,
        },
      })

      const result = await service.calculateGasQuoteForIntent(dto)

      expect(result.error).toBeUndefined()
      expect(result.response).toEqual({
        estimations: expect.any(Object),
        gasCost: (mockGasEstimate * mockGasPrice * 110n) / 100n, // Plus 10% buffer
      })
    })

    it('should handle errors gracefully', async () => {
      const dto = new GaslessIntentRequestDTO()

      const txs: ExecuteSmartWalletArg[] = [
        { to: '0xabc123...', data: '0x00', value: 0n },
        { to: '0xdef456...', data: '0x01', value: 0n },
      ]

      const mockChainID = 1
      const fundForTxsPerChain = getFundForTxsPerChain(mockChainID, txs)

      jest.spyOn(service, 'generateGaslessIntentTransactions').mockResolvedValue({
        response: {
          permitDataPerChain: new Map<number, PermitResult>(),
          fundForTxsPerChain,
        },
      })

      kernelMock.estimateGas.mockRejectedValue(new Error('boom'))

      const result = await service.calculateGasQuoteForIntent(dto)

      expect(result.response).toBeUndefined()
      expect(result.error?.code).toEqual(InternalQuoteError().code)
    })
  })
})
