import { createMock } from '@golevelup/ts-jest'
import { EcoError } from '@/common/errors/eco-error'
import { PermitParams } from '@/intent-initiation/permit-validation/interfaces/permit-params.interface'
import { PermitValidator } from '@/intent-initiation/permit-validation/permit-validator'
import { PublicClient, Address } from 'viem'
import * as viem from 'viem'

jest.mock('viem', () => ({
  ...jest.requireActual('viem'),
  verifyTypedData: jest.fn(),
}))

describe('PermitValidator', () => {
  const tokenAddress = '0xToken' as Address
  const owner = '0xOwner' as Address
  const spender = '0xSpender' as Address
  const value = 1000n
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1hr from now
  const nonce = 1n
  const signature = '0xSig' as `0x${string}`

  let client: PublicClient

  function validPermit(): PermitParams {
    return {
      tokenAddress,
      owner,
      spender,
      value,
      deadline,
      nonce,
      signature,
    }
  }

  beforeEach(() => {
    client = createMock<PublicClient>({
      readContract: jest.fn().mockResolvedValue(nonce),
    })

    ;(viem.verifyTypedData as jest.Mock).mockResolvedValue(true)
  })

  it('should validate a correct permit', async () => {
    const permit: PermitParams = validPermit()
    const result = await PermitValidator.validatePermit(client, permit)
    expect(result).toEqual({})
  })

  it('should skip sig validation if nonce is missing', async () => {
    const noncelessPermit = { ...validPermit(), nonce: undefined }
    const result = await PermitValidator.validatePermitSignature(client, noncelessPermit)
    expect(result).toEqual({})
  })

  it('should return error if permit is expired', async () => {
    const expiredPermit = { ...validPermit(), deadline: BigInt(Math.floor(Date.now() / 1000) - 100) }
    const result = await PermitValidator.validatePermit(client, expiredPermit)
    expect(result).toEqual({ error: EcoError.PermitExpired })
  })

  it('should return error if signature is invalid', async () => {
    ;(viem.verifyTypedData as jest.Mock).mockResolvedValue(false)

    const result = await PermitValidator.validatePermitSignature(client, validPermit())
    expect(result).toEqual({ error: EcoError.InvalidPermitSignature })
  })

  it('should return error if nonce does not match on-chain', async () => {
    const badClient = createMock<PublicClient>({
      readContract: jest.fn().mockResolvedValue(5n),
    })

    const result = await PermitValidator.validateNonce(badClient, tokenAddress, owner, nonce)
    expect(result).toEqual({ error: EcoError.InvalidPermitNonce })
  })
})
