jest.spyOn(viem, 'verifyTypedData').mockResolvedValue(true)

const logger = new Logger('IntentInitiationServiceSpec')

let $: EcoTester
let service: IntentInitiationService
let permitProcessor: PermitProcessor
let permit2Processor: Permit2Processor
let quoteRepository: QuoteRepository
let kernelAccountClientService: KernelAccountClientService

const intentTestUtils = new IntentTestUtils()
const quoteTestUtils = new QuoteTestUtils()

describe('IntentInitiationService', () => {
  const mockTx: ExecuteSmartWalletArg = {
    to: '0x8c182a808f75a29c0f02d4ba80ab236ab01c0ace',
    data: '0x123',
    value: 0n,
  }

  let kernelMock: jest.Mocked<KernelAccountClientService>

  const mockReceipt: TransactionReceipt = {
    transactionHash: '0xtx',
  } as unknown as TransactionReceipt

  beforeAll(async () => {
    kernelMock = createMock<KernelAccountClientService>()

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
        PermitProcessor,
        Permit2Processor,
        // QuoteService,
        QuoteRepository,
        PermitTxBuilder,
        Permit2TxBuilder,
        PermitValidationService,
        {
          provide: getModelToken(QuoteIntentModel.name),
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            updateOne: jest.fn(),
          },
        },
        {
          provide: EcoConfigService, // ⬅ inject the actual mocked provider here
          useValue: new EcoConfigService([mockSource as any]),
        },
        {
          provide: KernelAccountClientService,
          useValue: kernelMock,
        },
        {
          provide: WalletClientDefaultSignerService,
          useClass: quoteTestUtils.getMockWalletClientDefaultSignerService(),
        },
      ])
      .withMocks([
        FeeService,
        ValidationService,
        SignerKmsService,
        CreateIntentService,
        EcoAnalyticsService,
      ])

    service = await $.init()
    permitProcessor = $.get(PermitProcessor)
    permit2Processor = $.get(Permit2Processor)
    quoteRepository = $.get(QuoteRepository)
    kernelAccountClientService = $.get(KernelAccountClientService)
  })

  describe('Intent Execution', () => {
    beforeEach(() => {
      // Mock checkGaslessIntentSupported implementation
      service['checkGaslessIntentSupported'] = () => ({})
    })

    it('fails if quote not found', async () => {
      const dto = intentTestUtils.createGaslessIntentRequestDTO({
        usePermit: false,
        isBatchPermit2: false,
        token: '0x0000000000000000000000000000000000000001',
      })

      jest
        .spyOn(quoteRepository, 'fetchQuoteIntentData')
        .mockResolvedValue({ error: EcoError.QuoteNotFound }) // simulate quote not found

      const result = await service.initiateGaslessIntent(dto)
      expect(result.error.message).toContain('Quote not found')
    })

    it('executes intent with permit2', async () => {
      const dto = intentTestUtils.createGaslessIntentRequestDTO({
        usePermit: false,
        isBatchPermit2: false,
        token: '0x0000000000000000000000000000000000000001',
      })

      const permit2Tx = { ...mockTx, data: '0xpermit2' as Hex }

      jest.spyOn(permit2Processor, 'generateTxs').mockReturnValue({ response: [permit2Tx] })
      jest
        .spyOn(quoteRepository, 'fetchQuoteIntentData')
        .mockResolvedValue({ response: quoteTestUtils.asQuoteIntentModel(dto) })
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
      jest
        .spyOn(quoteRepository, 'fetchQuoteIntentData')
        .mockResolvedValue({ response: quoteTestUtils.asQuoteIntentModel(dto) })
      jest.spyOn(kernelAccountClientService, 'getClient').mockResolvedValue({
        execute: jest.fn().mockResolvedValue('0xtx'),
        waitForTransactionReceipt: jest.fn().mockResolvedValue(mockReceipt),
      } as any)

      const result = await service.initiateGaslessIntent(dto)
      expect(result.response?.transactionHash).toBe('0xtx')
    })
  })

  describe('Intent Gas Estimation', () => {
    it('should calculate gas quote correctly', async () => {
      const dto = new GaslessIntentRequestDTO()
      dto.getSourceChainID = () => 5 // example Goerli chainId

      const txs: ExecuteSmartWalletArg[] = [
        { to: '0xabc123...', data: '0x00', value: 0n },
        { to: '0xdef456...', data: '0x01', value: 0n },
      ]

      const mockGasEstimate = 100_000n
      const mockGasPrice = 50_000_000_000n // 50 gwei

      jest.spyOn(service, 'generateGaslessIntentTransactions').mockResolvedValue({ response: txs })

      kernelMock.estimateGasForKernelExecution.mockResolvedValue({
        response: {
          gasEstimate: mockGasEstimate,
          gasPrice: mockGasPrice,
        },
      })

      const result = await service.calculateGasQuoteForIntent(dto)

      expect(result.error).toBeUndefined()
      expect(result.response).toEqual({
        gasEstimate: mockGasEstimate,
        gasPrice: mockGasPrice,
        gasCost: expect.any(BigInt),
      })
    })

    it('should handle errors gracefully', async () => {
      const dto = new GaslessIntentRequestDTO()
      dto.getSourceChainID = () => 5

      jest.spyOn(service, 'generateGaslessIntentTransactions').mockResolvedValue({ response: [] })

      kernelMock.estimateGasForKernelExecution.mockRejectedValue(new Error('boom'))

      const result = await service.calculateGasQuoteForIntent(dto)

      expect(result.response).toBeUndefined()
      expect(result.error?.code).toEqual(InternalQuoteError().code)
    })
  })
})
