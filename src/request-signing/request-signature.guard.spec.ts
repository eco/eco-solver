import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RequestSignatureGuard } from '@/request-signing/request-signature.guard'
import { SignatureVerificationService } from '@/request-signing/signature-verification.service'
import {
  SIGNATURE_ADDRESS_HEADER,
  SIGNATURE_EXPIRE_HEADER,
  SIGNATURE_HEADER,
} from '@/request-signing/signature-headers'
import { SignatureGenerator } from '@/request-signing/signature-generator'
import { LocalAccount, privateKeyToAccount } from 'viem/accounts'
import { Hex } from 'viem'

type MockEcoConfigService = Pick<
  EcoConfigService,
  'isRequestSignatureValidationEnabled' | 'getDynamicConfigAllowedAddresses'
>

const TestPrivateKey =
  '0xae647e8ce1871eb6555401960e710b5957c3462c354f80c2d840845a40a17ac9' as Hex
const TestAccount: LocalAccount = privateKeyToAccount(TestPrivateKey)

describe('RequestSignatureGuard', () => {
  let ecoConfigService: jest.Mocked<MockEcoConfigService>
  let signatureVerificationService: SignatureVerificationService
  let signatureGenerator: SignatureGenerator
  let guard: RequestSignatureGuard

  const buildExecutionContext = async (
    overrides: Partial<{
      method: string
      url: string
      body: any
      expiry: number
      claimedAddress: string
      headers: Record<string, any>
    }> = {},
  ): Promise<ExecutionContext> => {
    const method = overrides.method ?? 'POST'
    const url = overrides.url ?? '/dynamic-config'
    const body = overrides.body ?? { test: true }
    const expiry = overrides.expiry ?? Date.now() + 60_000
    const claimedAddress = overrides.claimedAddress ?? TestAccount.address
    const payload = method === 'GET' || method === 'DELETE' ? { path: url } : body

    const { signature } = await signatureGenerator.signPayload(TestAccount, payload, expiry)

    const headers: Record<string, any> = {
      [SIGNATURE_HEADER]: signature,
      [SIGNATURE_ADDRESS_HEADER]: claimedAddress,
      [SIGNATURE_EXPIRE_HEADER]: expiry,
      ...(overrides.headers ?? {}),
    }

    Object.keys(headers).forEach((key) => {
      if (headers[key] === undefined) {
        delete headers[key]
      }
    })

    const request = {
      method,
      url,
      body,
      headers,
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext
  }

  beforeEach(() => {
    signatureGenerator = new SignatureGenerator()
    signatureVerificationService = new SignatureVerificationService()

    ecoConfigService = {
      isRequestSignatureValidationEnabled: jest.fn().mockReturnValue(true),
      getDynamicConfigAllowedAddresses: jest.fn().mockReturnValue([TestAccount.address]),
    }

    guard = new RequestSignatureGuard(
      ecoConfigService as unknown as EcoConfigService,
      signatureVerificationService,
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('allows requests when validation is disabled', async () => {
    ecoConfigService.isRequestSignatureValidationEnabled.mockReturnValue(false)

    const result = await guard.canActivate(await buildExecutionContext())

    expect(result).toBe(true)
  })

  it.each([
    ['signature', SIGNATURE_HEADER],
    ['expiry', SIGNATURE_EXPIRE_HEADER],
  ])('returns false when %s header missing', async (_, headerName) => {
    const context = await buildExecutionContext({
      headers: { [headerName]: undefined },
    })

    await expect(guard.canActivate(context)).resolves.toBe(false)
  })

  it('verifies payload signed with body for mutating methods', async () => {
    const payload = { foo: 'bar' }
    const context = await buildExecutionContext({
      method: 'PUT',
      body: payload,
    })
    const verifySpy = jest.spyOn(signatureVerificationService, 'verifySignature')

    await expect(guard.canActivate(context)).resolves.toBe(true)
    expect(verifySpy).toHaveBeenCalledWith(
      payload,
      expect.any(String),
      expect.any(Number),
      TestAccount.address,
    )
  })

  it.each(['GET', 'DELETE'])(
    'verifies payload signed with url path for %s requests',
    async (method) => {
      const url = '/dynamic-config?limit=2'
      const context = await buildExecutionContext({
        method,
        url,
        body: { should: 'not matter' },
      })
      const verifySpy = jest.spyOn(signatureVerificationService, 'verifySignature')

      await guard.canActivate(context)

      expect(verifySpy).toHaveBeenCalledWith(
        { path: url },
        expect.any(String),
        expect.any(Number),
        TestAccount.address,
      )
    },
  )

  it('throws UnauthorizedException when signature verification fails', async () => {
    const context = await buildExecutionContext({
      claimedAddress: '0x1234567890123456789012345678901234567890',
    })

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException)
  })

  it('throws UnauthorizedException when address is not allowed', async () => {
    ecoConfigService.getDynamicConfigAllowedAddresses.mockReturnValue(['0xabcdef'])
    const verifySpy = jest.spyOn(signatureVerificationService, 'verifySignature')

    const context = await buildExecutionContext()

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException)

    // ensure the guard reached the allowlist check by confirming signature verification succeeded
    expect(verifySpy).toHaveBeenCalled()
    const verifyResult = await verifySpy.mock.results[0]!.value
    expect(verifyResult.error).toBeUndefined()
  })

  it('throws UnauthorizedException when verification service rejects', async () => {
    jest
      .spyOn(signatureVerificationService, 'verifySignature')
      .mockRejectedValue(new Error('boom'))

    await expect(guard.canActivate(await buildExecutionContext())).rejects.toThrow(
      UnauthorizedException,
    )
  })
})
