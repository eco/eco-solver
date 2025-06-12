import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { CreateIntentService } from '@/intent/create-intent.service'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { EcoError } from '@/common/errors/eco-error'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { Hex } from 'viem'
import { IntentInitiationController } from '@/api/intent-initiation.controller'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { IntentTestUtils } from '@/intent-initiation/test-utils/intent-test-utils'
import { InternalQuoteError } from '@/quote/errors'
import { Permit2Processor } from '@/common/permit/permit2-processor'
import { PermitProcessor } from '@/common/permit/permit-processor'
import { PermitValidationService } from '@/intent-initiation/permit-validation/permit-validation.service'
import { QuoteRepository } from '@/quote/quote.repository'
import { QuoteService } from '@/quote/quote.service'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

const intentTestUtils = new IntentTestUtils()

let $: EcoTester
let controller: IntentInitiationController
let service: IntentInitiationService
const quoteTestUtils = new QuoteTestUtils()

describe('IntentInitiationController', () => {
  beforeAll(async () => {

    const mockSource = {
      getConfig: () => ({
        rpcs: {
          keys: {
            '0x1234': '0x1234',
          },
        },
      }),
    }

    $ = EcoTester.setupTestFor(IntentInitiationController)
      .withProviders([
        IntentInitiationService,
        Permit2Processor,
        PermitProcessor,
        PermitValidationService,
        QuoteService,
        {
          provide: WalletClientDefaultSignerService,
          useClass: quoteTestUtils.getMockWalletClientDefaultSignerService(),
        },
        {
          provide: EcoConfigService,
          useValue: new EcoConfigService([mockSource as any]),
        },
      ])
      .withMocks([QuoteService, QuoteRepository, CreateIntentService])

    controller = await $.init()
    service = $.get(IntentInitiationService)
  })

  it('returns response when successful', async () => {
    const dto = intentTestUtils.createGaslessIntentRequestDTO()
    const mockResponse = {
      successes: [
        {
          chainID: 10,
          quoteIDs: ['quote1', 'quote2'],
          transactionHash: '0x123' as Hex,
        },
      ],
      failures: [],
    }

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
