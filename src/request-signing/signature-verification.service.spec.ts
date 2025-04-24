import { EcoConfigService } from "@/eco-configs/eco-config.service"
import { EcoTester } from "@/common/test-utils/eco-tester/eco-tester"
import { SignatureGenerator } from "@/request-signing/signature-generator"
import { SignatureVerificationService } from "@/request-signing/signature-verification.service"
import { SigningService } from "@/request-signing/signing-service"

describe('SignatureVerificationService', () => {
  let $: EcoTester
  let service: SignatureVerificationService
  let signingService: SigningService

  beforeAll(async () => {
    const mockEcoConfigService = {
      getConfig: () => ({
        requestSigner: {
          privateKey: '0xae647e8ce1871eb6555401960e710b5957c3462c354f80c2d840845a40a17ac9',
        },
      }),
    }

    $ = EcoTester.setupTestFor(SignatureVerificationService)
      .withProviders([
        SigningService,
        SignatureGenerator,
        {
          provide: EcoConfigService, // ⬅ inject the actual mocked provider here
          useValue: mockEcoConfigService,
        },
      ])

    service = await $.init()
    signingService = $.get(SigningService)
  })

  it('should verify a valid signature and return the signer address', async () => {
    const payload = { hello: 'world' }
    const expiryTime = Math.floor(Date.now() / 1000) + 60

    const { signature } = await signingService.signPayload(payload, expiryTime)

    const recoveredAddress = await service.verifySignature(payload, signature, expiryTime)

    expect(recoveredAddress).toEqual(signingService.getAccountAddress())
  })

  it('should throw if signature is expired', async () => {
    const payload = { expired: true }
    const expiryTime = Math.floor(Date.now() / 1000) - 10 // already expired
    const { signature } = await signingService.signPayload(payload, expiryTime)

    await expect(service.verifySignature(payload, signature, expiryTime)).rejects.toThrow(
      /Signature expired/,
    )
  })
})
