import { createMock } from '@golevelup/ts-jest'
import { EcoError } from '@/common/errors/eco-error'
import { EcoTester } from '@/common/test-utils/eco-tester/eco-tester'
import { Permit2Validator } from '@/intent-initiation/permit-validation/permit2-validator'
import { PermitTestUtils } from '@/intent-initiation/test-utils/permit-test-utils'
import { PermitValidationService } from '@/intent-initiation/permit-validation/permit-validation.service'
import { PermitValidator } from '@/intent-initiation/permit-validation/permit-validator'
import { PublicClient, Signature } from 'viem'
import { QuoteRewardDataDTO } from '@/quote/dto/quote.reward.data.dto'
import { QuoteTestUtils } from '@/intent-initiation/test-utils/quote-test-utils'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

jest.mock('@/intent-initiation/permit-validation/permit-validator', () => {
  // Import the real module first
  const actual = jest.requireActual('@/intent-initiation/permit-validation/permit-validator')

  return {
    __esModule: true,
    ...actual,
    validatePermits: jest.fn(), // override with mock
    parseSignature: jest.fn(), // override with mock
    // getPermitCalls will remain as real
  }
})

jest.mock('@/intent-initiation/permit-validation/permit2-validator', () => {
  // Import the real module first
  const actual = jest.requireActual('@/intent-initiation/permit-validation/permit2-validator')

  return {
    __esModule: true,
    ...actual,
    validatePermits: jest.fn(), // override with mock
    validatePermitSignature: jest.fn(), // override with mock
    // getPermitCalls will remain as real
  }
})

const mockSimulateContract = jest.fn()
const mockPublicClient = createMock<PublicClient>({
  simulateContract: mockSimulateContract,
})

// const mockWalletClientService = createMock<WalletClientDefaultSignerService>({
//   getPublicClient: jest.fn().mockResolvedValue({
//     ...mockPublicClient,
//     extend: () => mockPublicClient,
//   }),
// })

describe('PermitValidationService', () => {
  let $: EcoTester
  let service: PermitValidationService
  const quoteTestUtils = new QuoteTestUtils()
  const permitTestUtils = new PermitTestUtils()
  const mockWalletClientDefaultSignerService =
    quoteTestUtils.getMockWalletClientDefaultSignerService()

  const mockLogLog = jest.fn()
  const mockLogWarn = jest.fn()
  const mockLogDebug = jest.fn()
  const mockLogError = jest.fn()

  beforeAll(async () => {
    $ = EcoTester.setupTestFor(PermitValidationService)
      .withProviders([
        {
          provide: WalletClientDefaultSignerService,
          useClass: mockWalletClientDefaultSignerService,
        },
      ])
      .withMocks([])

    service = await $.init()
    mockWalletClientDefaultSignerService.prototype.getPublicClient = jest.fn().mockResolvedValue({
      ...mockPublicClient,
      extend: () => mockPublicClient,
    })

    service['logger'].log = mockLogLog
    service['logger'].warn = mockLogWarn
    service['logger'].debug = mockLogDebug
    service['logger'].error = mockLogError
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    mockLogLog.mockClear()
    mockLogWarn.mockClear()
    mockLogDebug.mockClear()
    mockLogError.mockClear()
  })

  it('returns error if vault address is invalid', async () => {
    const { error } = await service.validatePermits({
      chainId: 1,
      permits: [],
      spender: quoteTestUtils.getRandomAddress(),
      expectedVault: quoteTestUtils.getRandomAddress(),
      owner: quoteTestUtils.getRandomAddress(),
      reward: QuoteRewardDataDTO.fromJSON({ tokens: [] }),
    })

    expect(error).toEqual(EcoError.InvalidVaultAddress)
  })

  it('returns error from PermitValidator', async () => {
    jest
      .spyOn(PermitValidator, 'validatePermits')
      .mockResolvedValue({ error: EcoError.InvalidPermitSignature })
    const spender = quoteTestUtils.getRandomAddress()

    const { error } = await service.validatePermits({
      chainId: 1,
      permits: [permitTestUtils.createPermitDTO()],
      spender,
      expectedVault: spender,
      owner: quoteTestUtils.getRandomAddress(),
      reward: QuoteRewardDataDTO.fromJSON({ tokens: [] }),
    })

    expect(error).toEqual(EcoError.InvalidPermitSignature)
  })

  it('returns error from Permit2Validator', async () => {
    jest.spyOn(PermitValidator, 'validatePermits').mockResolvedValue({})
    jest
      .spyOn(Permit2Validator, 'validatePermits')
      .mockResolvedValue({ error: EcoError.InvalidPermit2Address })
    const spender = quoteTestUtils.getRandomAddress()

    const { error } = await service.validatePermits({
      chainId: 1,
      permits: [permitTestUtils.createPermitDTO()],
      permit2: permitTestUtils.createPermit2DTO(
        {},
        { isBatch: true, token: quoteTestUtils.getRandomAddress() },
      ),
      spender,
      expectedVault: spender,
      owner: quoteTestUtils.getRandomAddress(),
      reward: QuoteRewardDataDTO.fromJSON({ tokens: [] }),
    })

    expect(error).toEqual(EcoError.InvalidPermit2Address)
  })

  it('returns error if simulateContract fails', async () => {
    jest.spyOn(PermitValidator, 'validatePermits').mockResolvedValue({})
    jest.spyOn(Permit2Validator, 'validatePermits').mockResolvedValue({})
    jest
      .spyOn(PermitValidator, 'parseSignature')
      .mockReturnValue({ v: 0n, r: '0x', s: '0x' } satisfies Signature)
    mockSimulateContract.mockRejectedValueOnce(new Error('boom'))
    const spender = quoteTestUtils.getRandomAddress()
    const permit = permitTestUtils.createPermitDTO()

    const { error } = await service.validatePermits({
      chainId: 1,
      permits: [permit],
      spender,
      expectedVault: spender,
      owner: quoteTestUtils.getRandomAddress(),
      reward: quoteTestUtils.createQuoteRewardDataDTO({
        tokens: [
          {
            token: permit.token,
            amount: 100n,
          },
        ],
      }),
    })

    expect(error).toEqual(EcoError.PermitSimulationsFailed)
  })

  it('returns success when all validations pass', async () => {
    jest.spyOn(PermitValidator, 'validatePermits').mockResolvedValue({})
    jest.spyOn(Permit2Validator, 'validatePermits').mockResolvedValue({})
    jest
      .spyOn(PermitValidator, 'parseSignature')
      .mockReturnValue({ v: 0n, r: '0x', s: '0x' } satisfies Signature)
    mockSimulateContract.mockResolvedValue({})
    const spender = quoteTestUtils.getRandomAddress()
    const permit = permitTestUtils.createPermitDTO()

    const { response: result } = await service.validatePermits({
      chainId: 1,
      permits: [permit],
      spender,
      expectedVault: spender,
      owner: quoteTestUtils.getRandomAddress(),
      reward: quoteTestUtils.createQuoteRewardDataDTO({
        tokens: [
          {
            token: permit.token,
            amount: 100n,
          },
        ],
      }),
    })

    expect(result).toEqual(undefined)
  })
})
