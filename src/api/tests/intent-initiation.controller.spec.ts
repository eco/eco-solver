import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { IntentInitiationController } from '@/api/intent-initiation.controller'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { IntentTestUtils } from '@/intent-initiation/test-utils/intent-test-utils'
import { InternalQuoteError } from '@/quote/errors'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Permit2Processor } from '@/permit-processing/permit2-processor'
import { Permit2TxBuilder } from '@/permit-processing/permit2-tx-builder'
import { PermitProcessor } from '@/permit-processing/permit-processor'
import { PermitTxBuilder } from '@/permit-processing/permit-tx-builder'
import { PermitValidationService } from '@/intent-initiation/permit-validation/permit-validation.service'
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteService } from '@/quote/quote.service'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { TransactionReceipt } from 'viem'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { createMock } from '@golevelup/ts-jest'

const intentTestUtils = new IntentTestUtils()

let $: EcoTester
let controller: IntentInitiationController
let service: IntentInitiationService
const quoteTestUtils = new QuoteTestUtils()

describe('IntentInitiationController', () => {
  beforeAll(async () => {
    $ = EcoTester.setupTestFor(IntentInitiationController)
      .withProviders([
        IntentInitiationService,
        KernelAccountClientService,
        Permit2Processor,
        Permit2TxBuilder,
        PermitProcessor,
        PermitTxBuilder,
        PermitValidationService,
        QuoteService,
        {
          provide: WalletClientDefaultSignerService,
          useClass: quoteTestUtils.getMockWalletClientDefaultSignerService(),
        },
        {
          provide: EcoConfigService,
          useValue: createMock<EcoConfigService>(),
        },
      ])
      .withMocks([QuoteService, QuoteRepository, KernelAccountClientService, CreateIntentService])

    controller = await $.init()
    service = $.get(IntentInitiationService)
  })

  it('returns response when successful', async () => {
    const dto = intentTestUtils.createGaslessIntentRequestDTO()
    const mockResponse = { transactionHash: '0x123' } as unknown as TransactionReceipt

    jest.spyOn(service, 'initiateGaslessIntent').mockResolvedValue({ response: mockResponse })

    const result = await controller.initiateGaslessIntent(dto)
    expect(result).toEqual(mockResponse)
  })

  it('throws BadRequestException for 400 error', async () => {
    const dto = intentTestUtils.createGaslessIntentRequestDTO()

    jest.spyOn(service, 'initiateGaslessIntent').mockResolvedValue({
      error: { ...InternalQuoteError(), statusCode: 400 },
    })

    await expect(controller.initiateGaslessIntent(dto)).rejects.toThrow(BadRequestException)
  })

  it('throws InternalServerErrorException for unexpected error', async () => {
    const dto = intentTestUtils.createGaslessIntentRequestDTO()

    jest.spyOn(service, 'initiateGaslessIntent').mockResolvedValue({
      error: { ...InternalQuoteError(EcoError.QuoteNotFound) },
    })

    await expect(controller.initiateGaslessIntent(dto)).rejects.toThrow(
      InternalServerErrorException,
    )
  })

  it('throws InternalServerErrorException for error without statusCode', async () => {
    const dto = intentTestUtils.createGaslessIntentRequestDTO()

    jest.spyOn(service, 'initiateGaslessIntent').mockResolvedValue({
      error: { ...InternalQuoteError(new Error('Something went wrong')) }, // ← no `statusCode`!
    })

    await expect(controller.initiateGaslessIntent(dto)).rejects.toThrow(
      InternalServerErrorException,
    )
  })
})
