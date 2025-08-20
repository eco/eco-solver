import { EcoConfigService } from '@libs/config-core'
import { EcoTester } from '@eco-solver/common/test-utils/eco-tester/eco-tester'
import { SignatureGenerator } from '@eco-solver/request-signing/signature-generator'
import { SigningService } from '@eco-solver/request-signing/signing.service'
import { WalletClientDefaultSignerService } from '@eco-solver/transaction/smart-wallets/wallet-client.service'
import { LocalAccount, privateKeyToAccount } from 'viem/accounts'
import { Hex } from "viem"

class MockWalletClientDefaultSignerService {
  private account: LocalAccount

  constructor() {
    const privateKey: Hex = '0xae647e8ce1871eb6555401960e710b5957c3462c354f80c2d840845a40a17ac9'
    this.account = privateKeyToAccount(privateKey)
  }

  async getAccount(): Promise<LocalAccount> {
    return this.account
  }
}

describe('SigningService', () => {
  let $: EcoTester
  let service: SigningService

  beforeAll(async () => {
    const mockEcoConfigService = {
      getConfig: () => ({
        requestSigner: {
          privateKey: '0xae647e8ce1871eb6555401960e710b5957c3462c354f80c2d840845a40a17ac9',
        },
      }),
    }

    $ = EcoTester.setupTestFor(SigningService).withProviders([
      SignatureGenerator,
      {
        provide: WalletClientDefaultSignerService,
        useClass: MockWalletClientDefaultSignerService,
      },
      {
        provide: EcoConfigService, // ⬅ inject the actual mocked provider here
        useValue: mockEcoConfigService,
      },
    ])

    service = await $.init()
  })

  it('should sign a payload with expiry and return a valid signature', async () => {
    const payload = { foo: 'bar', nested: { a: 1 } }
    const expiryTime = Math.floor(Date.now() / 1000) + 60

    const { signature, expiryTime: returnedExpiry } = await service.signPayload(payload, expiryTime)

    expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/)
    expect(returnedExpiry).toEqual(expiryTime)
  })
})
