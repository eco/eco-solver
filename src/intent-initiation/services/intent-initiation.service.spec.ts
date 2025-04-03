import { DBTestUtils } from '../../common/test-utils/db-test-utils'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { EcoError } from '../../common/errors/eco-error'
import { EcoTester } from '../../common/test-utils/eco-tester/eco-tester'
import { ExecuteSmartWalletArg } from '../../transaction/smart-wallets/smart-wallet.types'
import { FeeService } from '../../fee/fee.service'
import { Hex, TransactionReceipt } from 'viem'
import { IntentInitiationService } from './intent-initiation.service'
import { IntentTestUtils } from '../test-utils/intent-test-utils'
import { KernelAccountClientService } from '../../transaction/smart-wallets/kernel/kernel-account-client.service'
import { Logger } from '@nestjs/common'
import { Permit2Processor } from '../../permit-processing/permit2-processor'
import { Permit2TxBuilder } from '../../permit-processing/permit2-tx-builder'
import { PermitProcessor } from '../../permit-processing/permit-processor'
import { PermitTxBuilder } from '../../permit-processing/permit-tx-builder'
import { QuoteIntentSchema } from '../../quote/schemas/quote-intent.schema'
import { QuoteService } from '../../quote/quote.service'
import { QuoteTestUtils } from '../test-utils/quote-test-utils'
import { SignerKmsService } from '../../sign/signer-kms.service'
import { ValidationService } from '../../intent/validation.sevice'

const logger = new Logger('IntentInitiationServiceSpec')

let $: EcoTester
let dbTestUtils: DBTestUtils
let service: IntentInitiationService
let permitProcessor: PermitProcessor
let permit2Processor: Permit2Processor
let quoteService: QuoteService
let kernelAccountClientService: KernelAccountClientService

const intentTestUtils = new IntentTestUtils()
const quoteTestUtils = new QuoteTestUtils()

export const createMockEcoConfigService = () => ({
  get: jest.fn().mockReturnValue({}),
  getAlchemy: jest.fn().mockReturnValue({
    networks: [{ id: 1 }],
    apiKey: 'fake-key',
  }),
  getEth: jest.fn().mockReturnValue({ pollingInterval: 1000 }),
})


describe('IntentInitiationService', () => {
  const mockTx: ExecuteSmartWalletArg = {
    to: '0x8c182a808f75a29c0f02d4ba80ab236ab01c0ace',
    data: '0x123',
    value: 0n,
  }

  const mockReceipt: TransactionReceipt = {
    transactionHash: '0xtx',
  } as unknown as TransactionReceipt

  beforeAll(async () => {
    const mockSource = {
      getConfig: () => ({
        'IntentSource.1': '0x0000000000000000000000000000000000000001',
        'Prover.1': '0x0000000000000000000000000000000000000002',
        'HyperProver.1': '0x0000000000000000000000000000000000000003',
        'Inbox.1': '0x0000000000000000000000000000000000000004',
        alchemy: {
          networks: [{ id: 1 }, { id: 137 }],
          apiKey: 'fake-alchemy-api-key',
        },
        eth: {
          pollingInterval: 1000,
        },
      }),
    }

    dbTestUtils = new DBTestUtils()
    await dbTestUtils.dbOpen()

    $ = EcoTester
      .setupTestFor(IntentInitiationService)
      .withProviders([
        PermitProcessor,
        Permit2Processor,
        QuoteService,
        KernelAccountClientService,
        PermitTxBuilder,
        Permit2TxBuilder,
      ])
      .overridingProvider(EcoConfigService)
      .with(new EcoConfigService([mockSource as any]))
      .withMocks([
        FeeService,
        ValidationService,
        SignerKmsService,
      ])
      .withSchemas([
        ['QuoteIntentModel', QuoteIntentSchema],
      ])

    service = await $.init()
    permitProcessor = $.get(PermitProcessor)
    permit2Processor = $.get(Permit2Processor)
    quoteService = $.get(QuoteService)
    kernelAccountClientService = $.get(KernelAccountClientService)
  })

  afterAll(async () => {
    await dbTestUtils.dbClose()
  })

  it('fails if quote not found', async () => {
    const dto = intentTestUtils.createGaslessIntentRequestDTO({
      usePermit: false,
      isBatchPermit2: false,
      token: '0x0000000000000000000000000000000000000001',
    })

    jest
      .spyOn(quoteService, 'fetchQuoteIntentData')
      .mockResolvedValue(null) // simulate quote not found

    const result = await service.initiateGaslessIntent(dto)
    expect(result.error).toBe(EcoError.QuoteNotFound)
  })

  it('executes intent with permit2', async () => {
    const dto = intentTestUtils.createGaslessIntentRequestDTO({
      usePermit: false,
      isBatchPermit2: false,
      token: '0x0000000000000000000000000000000000000001',
    })

    const permit2Tx = { ...mockTx, data: '0xpermit2' as Hex }

    jest.spyOn(permit2Processor, 'generateTxs').mockReturnValue({ response: [permit2Tx] })
    jest.spyOn(quoteService, 'fetchQuoteIntentData').mockResolvedValue(quoteTestUtils.asQuoteIntentModel(dto))
    jest.spyOn(kernelAccountClientService, 'getClient').mockResolvedValue({
      execute: jest.fn().mockResolvedValue('0xtx'),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
    } as any)

    const result = await service.initiateGaslessIntent(dto)
    expect(result.response?.transactionHash).toBe('0xtx')
  })

  it('executes intent with permit', async () => {
    const dto = intentTestUtils.createGaslessIntentRequestDTO({
      usePermit: false,
      isBatchPermit2: false,
      token: '0x0000000000000000000000000000000000000001',
    })

    const permitTx = { ...mockTx, data: '0xpermit' as Hex }

    jest.spyOn(permitProcessor, 'generateTxs').mockReturnValue({ response: [permitTx] })
    jest.spyOn(quoteService, 'fetchQuoteIntentData').mockResolvedValue(quoteTestUtils.asQuoteIntentModel(dto))
    jest.spyOn(kernelAccountClientService, 'getClient').mockResolvedValue({
      execute: jest.fn().mockResolvedValue('0xtx'),
      waitForTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
    } as any)

    const result = await service.initiateGaslessIntent(dto)
    expect(result.response?.transactionHash).toBe('0xtx')
  })
})
