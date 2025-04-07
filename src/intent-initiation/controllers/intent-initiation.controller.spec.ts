import { BadRequestException, InternalServerErrorException } from '@nestjs/common'
import { EcoError } from '@/common/errors/eco-error'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { IntentInitiationController } from '@/intent-initiation/controllers/intent-initiation.controller'
import { IntentInitiationService } from '@/intent-initiation/services/intent-initiation.service'
import { IntentTestUtils } from '@/intent-initiation/test-utils/intent-test-utils'
import { InternalQuoteError } from '@/quote/errors'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Permit2Processor } from '@/permit-processing/permit2-processor'
import { Permit2TxBuilder } from '@/permit-processing/permit2-tx-builder'
import { PermitProcessor } from '@/permit-processing/permit-processor'
import { PermitTxBuilder } from '@/permit-processing/permit-tx-builder'
import { QuoteService } from '@/quote/quote.service'
import { TransactionReceipt } from 'viem'

const intentTestUtils = new IntentTestUtils()

let $: EcoTester
let controller: IntentInitiationController
let service: IntentInitiationService

describe('IntentInitiationController', () => {
  beforeAll(async () => {
    $ = EcoTester
      .setupTestFor(IntentInitiationController)
      .withProviders([
        PermitProcessor,
        Permit2Processor,
        QuoteService,
        KernelAccountClientService,
        PermitTxBuilder,
        Permit2TxBuilder,
        IntentInitiationService,
      ])
      .withMocks([
        QuoteService,
        KernelAccountClientService,
      ])

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

    await expect(controller.initiateGaslessIntent(dto)).rejects.toThrow(InternalServerErrorException)
  })

  it('throws InternalServerErrorException for error without statusCode', async () => {
    const dto = intentTestUtils.createGaslessIntentRequestDTO()

    jest.spyOn(service, 'initiateGaslessIntent').mockResolvedValue({
      error: { ...InternalQuoteError(new Error('Something went wrong')) }, // ← no `statusCode`!
    })

    await expect(controller.initiateGaslessIntent(dto)).rejects.toThrow(InternalServerErrorException)
  })
})
