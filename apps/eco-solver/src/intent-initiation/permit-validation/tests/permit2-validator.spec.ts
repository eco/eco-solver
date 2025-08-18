import { Address, Hex, PublicClient, verifyTypedData } from 'viem'
import { createMock } from '@golevelup/ts-jest'
import { EcoError } from '@eco-solver/common/errors/eco-error'
import { Permit2Params } from '@eco-solver/intent-initiation/permit-validation/interfaces/permit2-params.interface'
import { Permit2Validator } from '@eco-solver/intent-initiation/permit-validation/permit2-validator'

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  verifyTypedData: jest.fn(),
}))

const mockVerifyTypedData = verifyTypedData as jest.Mock

const now = Math.floor(Date.now() / 1000)

const validPermit: Permit2Params = {
  permit2Address: '0x000000000022D473030F116dDEE9F6B43aC78BA3' as Address,
  owner: '0x1111111111111111111111111111111111111111' as Address,
  spender: '0x2222222222222222222222222222222222222222' as Address,
  sigDeadline: BigInt(now + 3600),
  signature: '0xabcdef' as Hex,
  details: [
    {
      token: '0x3333333333333333333333333333333333333333' as Address,
      amount: 1000n,
      expiration: BigInt(now + 3600),
      nonce: 5n,
    },
  ],
}

describe('Permit2Validator', () => {
  let publicClient: PublicClient

  beforeEach(() => {
    publicClient = createMock<PublicClient>({
      readContract: jest.fn().mockResolvedValue([
        1000n, // amount
        BigInt(now + 3600), // on-chain expiration
        5n, // nonce
      ]),
    })

    mockVerifyTypedData.mockResolvedValue(true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should validate a valid permit without errors', async () => {
    const result = await Permit2Validator.validatePermits(publicClient, 1, [validPermit])
    expect(result).toEqual({})
    expect(mockVerifyTypedData).toHaveBeenCalled()
  })

  it('should return error for unknown Permit2 address', async () => {
    const invalid = {
      ...validPermit,
      permit2Address: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as Address,
    }
    const result = await Permit2Validator.validatePermit(publicClient, 1, invalid)
    expect(result.error).toBe(EcoError.InvalidPermit2Address)
  })

  it('should return error for expired sigDeadline', async () => {
    const expired = { ...validPermit, sigDeadline: BigInt(now - 100) }
    const result = await Permit2Validator.validatePermit(publicClient, 1, expired)
    expect(result.error).toBe(EcoError.PermitExpired)
  })

  it('should return error for invalid signature', async () => {
    mockVerifyTypedData.mockResolvedValue(false)
    const result = await Permit2Validator.validatePermitSignature(1, validPermit)
    expect(result.error).toBe(EcoError.InvalidPermitSignature)
  })

  it('should return error on nonce mismatch', async () => {
    ;(publicClient.readContract as jest.Mock).mockResolvedValue([
      1000n,
      BigInt(now + 3600),
      99n, // wrong nonce
    ])

    const result = await Permit2Validator.validateNonces(publicClient, validPermit)
    expect(result.error).toBe(EcoError.InvalidPermitNonce)
  })

  it('should return error on expired detail token', async () => {
    const expiredTokenPermit = {
      ...validPermit,
      details: [{ ...validPermit.details[0], expiration: BigInt(now - 10) }],
    }

    const result = await Permit2Validator.validateNonces(publicClient, expiredTokenPermit)
    expect(result.error).toBe(EcoError.PermitExpired)
  })

  it('should return error on expiration mismatch with onchain data', async () => {
    ;(publicClient.readContract as jest.Mock).mockResolvedValue([
      1000n,
      BigInt(now - 100), // on-chain expiration is earlier than signed
      5n,
    ])

    const result = await Permit2Validator.validateNonces(publicClient, validPermit)
    expect(result.error).toBe(EcoError.PermitExpirationMismatch)
  })

  it('should generate correct permit calls', () => {
    const calls = Permit2Validator.getPermitCalls([validPermit])
    expect(calls).toHaveLength(1)
    expect(calls[0].functionName).toBe('permit')
  })
})
