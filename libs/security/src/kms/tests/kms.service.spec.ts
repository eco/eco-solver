const mockGetAddress = jest.fn()

jest.mock('viem', () => {
  return {
    ...jest.requireActual('viem'),
    getAddress: mockGetAddress,
  }
})
describe('KmsService', () => {
  let service: KmsService
  let ecoConfigService: DeepMocked<IEcoConfigService>
  let logger: Logger

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KmsService,
        {
          provide: IEcoConfigService,
          useValue: createMock<IEcoConfigService>(),
        },
      ],
    }).compile()

    service = module.get<KmsService>(KmsService)
    ecoConfigService = module.get(IEcoConfigService)
    logger = new Logger()

    mockGetAddress.mockClear()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should throw an error if KMS config is missing', async () => {
    jest.spyOn(ecoConfigService, 'getKmsConfig').mockReturnValue(null as any)
    await expect(service.onModuleInit()).rejects.toThrow(EcoError.KmsCredentialsError(null as any))
  })

  it('should call viem to checksum and verify address', async () => {
    const ma = '0x123'
    const mockGetHex = jest.fn().mockResolvedValue(ma)
    mockGetAddress.mockResolvedValue(ma)
    service.wallets = {
      getAddressHex: mockGetHex,
    } as any
    expect(await service.getAddress()).toBe(ma)
    expect(mockGetAddress).toHaveBeenCalledTimes(1)
    expect(mockGetHex).toHaveBeenCalledTimes(1)
  })
})
