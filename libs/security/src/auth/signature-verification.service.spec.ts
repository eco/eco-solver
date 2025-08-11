const TestWalletAddress = '0xc3dD6EB9cd9683c3dd8B3d48421B3d5404FeedAC'
const TestPrivateKey = '0xae647e8ce1871eb6555401960e710b5957c3462c354f80c2d840845a40a17ac9'

class MockWalletClientDefaultSignerService {
  private account: LocalAccount

  constructor() {
    const privateKey: Hex = TestPrivateKey
    this.account = privateKeyToAccount(privateKey)
  }

  async getAccount(): Promise<LocalAccount> {
    return this.account
  }
}

describe('SignatureVerificationService', () => {
  let $: EcoTester
  let service: SignatureVerificationService
  let signingService: SigningService

  beforeAll(async () => {
    const mockIEcoConfigService = {
      getConfig: () => ({
        requestSigner: {
          privateKey: TestPrivateKey,
        },
      }),
    }

    $ = EcoTester.setupTestFor(SignatureVerificationService).withProviders([
      SigningService,
      SignatureGenerator,
      {
        provide: WalletClientDefaultSignerService,
        useClass: MockWalletClientDefaultSignerService,
      },
      {
        provide: IEcoConfigService, // ⬅ inject the actual mocked provider here
        useValue: mockIEcoConfigService,
      },
    ])

    service = await $.init()
    signingService = $.get(SigningService)
  })

  it('should verify a valid signature and return the signer address', async () => {
    const payload = { hello: 'world' }
    const expiryTime = Date.now() + 60_000

    const { signature } = await signingService.signPayload(payload, expiryTime)

    const { response: recoveredAddress, error } = await service.verifySignature(
      payload,
      signature,
      expiryTime,
      TestWalletAddress,
    )

    expect(error).toBeUndefined()
    expect(recoveredAddress).toEqual(signingService.getAccountAddress())
  })

  it('should throw if signature is expired', async () => {
    const payload = { expired: true }
    const expiryTime = Date.now() - 60_000 // 60s in the past
    const { signature } = await signingService.signPayload(payload, expiryTime)

    const { error } = await service.verifySignature(
      payload,
      signature,
      expiryTime,
      TestWalletAddress,
    )
    expect(error).toEqual(EcoError.SignatureExpired)
  })
})
