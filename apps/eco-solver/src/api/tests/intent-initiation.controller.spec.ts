import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { CreateIntentService } from '@eco-solver/intent/create-intent.service'
import { EcoError } from '@eco-solver/common/errors/eco-error'
import { EcoTester } from '@eco-solver/common/test-utils/eco-tester/eco-tester'
import { IntentInitiationController } from '@eco-solver/api/intent-initiation.controller'
import { IntentInitiationService } from '@eco-solver/intent-initiation/services/intent-initiation.service'
import { IntentTestUtils } from '@eco-solver/intent-initiation/test-utils/intent-test-utils'
import { InternalQuoteError } from '@eco-solver/quote/errors'
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Permit2Processor } from '@eco-solver/permit-processing/permit2-processor'
import { Permit2TxBuilder } from '@eco-solver/permit-processing/permit2-tx-builder'
import { PermitProcessor } from '@eco-solver/permit-processing/permit-processor'
import { PermitTxBuilder } from '@eco-solver/permit-processing/permit-tx-builder'
import { PermitValidationService } from '@eco-solver/intent-initiation/permit-validation/permit-validation.service'
import { QuoteRepository } from '@eco-solver/quote/quote.repository'
import { QuoteService } from '@eco-solver/quote/quote.service'
import { QuoteTestUtils } from '@eco-solver/intent-initiation/test-utils/quote-test-utils'
import { TransactionReceipt } from 'viem'
import { WalletClientDefaultSignerService } from '@eco-solver/transaction/smart-wallets/wallet-client.service'
import { EcoConfigService } from '@libs/solver-config'
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
