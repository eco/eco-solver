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
