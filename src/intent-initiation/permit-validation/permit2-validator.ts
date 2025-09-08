import { Call } from '@/intent-initiation/permit-validation/interfaces/call.interface'
import { EcoError } from '@/common/errors/eco-error'
import { IntentOperationLogger } from '@/common/logging/loggers'
import { LogOperation, LogContext } from '@/common/logging/decorators'
import { EcoResponse } from '@/common/eco-response'
import { Permit2Abi } from '@/contracts/Permit2.abi'
import { Permit2Params } from '@/intent-initiation/permit-validation/interfaces/permit2-params.interface'
import { PublicClient, verifyTypedData } from 'viem'

const KNOWN_PERMIT2_ADDRESSES = new Set(
  // eslint-disable-next-line prettier/prettier
  ['0x000000000022D473030F116dDEE9F6B43aC78BA3'].map((addr) => addr.toLowerCase()),
)

export class Permit2Validator {
  private logger = new IntentOperationLogger('Permit2Validator')

  @LogOperation('intent_validation', IntentOperationLogger)
  async validatePermits(
    client: PublicClient,
    chainId: number,
    @LogContext permits: Permit2Params[],
  ): Promise<EcoResponse<void>> {
    for (const permit of permits) {
      const { error } = await this.validatePermit(client, chainId, permit)

      if (error) {
        return { error }
      }
    }

    return {}
  }

  @LogOperation('permit_validation', IntentOperationLogger)
  async validatePermit(
    client: PublicClient,
    chainId: number,
    @LogContext permit: Permit2Params,
  ): Promise<EcoResponse<void>> {
    const { error } = this.validatePermitAddress(permit)

    if (error) {
      return { error }
    }

    // sigDeadline expiration check
    const { error: expirationError } = this.expirationCheck(permit.sigDeadline, `sigDeadline`)

    if (expirationError) {
      return { error: expirationError }
    }

    const { error: signatureError } = await this.validatePermitSignature(chainId, permit)

    if (signatureError) {
      return { error: signatureError }
    }

    return this.validateNonces(client, permit)
  }

  @LogOperation('permit_address_validation', IntentOperationLogger)
  validatePermitAddress(@LogContext permit: Permit2Params): EcoResponse<void> {
    const { permit2Address } = permit

    if (!KNOWN_PERMIT2_ADDRESSES.has(permit2Address.toLowerCase())) {
      // Log permit address validation failure
      this.logger.logPermitValidationResult(
        'unknown', // intentHash not available in this context
        'permit_simulation',
        false,
        new Error(`Permit2 address not whitelisted: ${permit2Address}`),
      )
      return { error: EcoError.InvalidPermit2Address }
    }

    // Log successful permit address validation
    this.logger.logPermitValidationResult(
      'unknown', // intentHash not available in this context
      'permit_simulation',
      true,
    )

    return {}
  }

  @LogOperation('permit_signature_validation', IntentOperationLogger)
  async validatePermitSignature(
    chainId: number,
    @LogContext permit: Permit2Params,
  ): Promise<EcoResponse<void>> {
    const { owner, spender, sigDeadline, details, permit2Address, signature } = permit

    const typedPermitDetails = details.map((d) => ({
      token: d.token,
      amount: d.amount,
      expiration: Number(d.expiration),
      nonce: Number(d.nonce),
    }))

    const validSig = await verifyTypedData({
      address: owner,
      domain: {
        name: 'Permit2',
        chainId,
        verifyingContract: permit2Address,
      },
      types: {
        PermitDetails: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
          { name: 'nonce', type: 'uint48' },
        ],
        PermitBatch: [
          { name: 'details', type: 'PermitDetails[]' },
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
      },
      primaryType: 'PermitBatch',
      message: {
        details: typedPermitDetails,
        spender,
        sigDeadline: BigInt(sigDeadline),
      },
      signature,
    })

    if (!validSig) {
      // Log permit signature validation failure
      this.logger.logPermitValidationResult(
        'unknown', // intentHash not available in this context
        'permit_simulation',
        false,
        new Error('Invalid permit signature'),
      )
      return { error: EcoError.InvalidPermitSignature }
    }

    // Log successful permit signature validation
    this.logger.logPermitValidationResult(
      'unknown', // intentHash not available in this context
      'permit_simulation',
      true,
    )

    return {}
  }

  @LogOperation('permit_nonce_validation', IntentOperationLogger)
  async validateNonces(
    client: PublicClient,
    @LogContext permit: Permit2Params,
  ): Promise<EcoResponse<void>> {
    const { permit2Address, owner, spender, details } = permit

    for (const detail of details) {
      const { nonce: expectedNonce, token } = detail

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [amount, onchainExpiration, actualNonce] = await client.readContract({
        address: permit2Address,
        abi: Permit2Abi,
        functionName: 'allowance',
        args: [owner, token, spender],
      })

      if (BigInt(actualNonce) !== expectedNonce) {
        // Log nonce validation failure
        this.logger.logPermitValidationResult(
          'unknown', // intentHash not available in this context
          'permit_simulation',
          false,
          new Error(`Nonce mismatch for token ${token}`),
        )
        return { error: EcoError.InvalidPermitNonce }
      }

      const { error: expirationError } = this.expirationCheck(
        detail.expiration,
        `token ${detail.token}`,
      )

      if (expirationError) {
        return { error: expirationError }
      }

      // Check if signed expiration is after onchain (expected)
      if (onchainExpiration < detail.expiration) {
        // Log expiration mismatch failure
        this.logger.logPermitValidationResult(
          'unknown', // intentHash not available in this context
          'permit_simulation',
          false,
          new Error('On-chain expiration is earlier than signed expiration'),
        )
        return { error: EcoError.PermitExpirationMismatch }
      }
    }

    // Log successful nonce validation for all permits
    this.logger.logPermitValidationResult(
      'unknown', // intentHash not available in this context
      'permit_simulation',
      true,
    )

    return {}
  }

  @LogOperation('permit_expiration_validation', IntentOperationLogger)
  expirationCheck(expiration: number | bigint, logMessage: string): EcoResponse<void> {
    const now = Math.floor(Date.now() / 1000)
    const expiry = typeof expiration === 'bigint' ? Number(expiration) : expiration

    if (expiry < now) {
      // Log permit expiration failure
      this.logger.logPermitValidationResult(
        'unknown', // intentHash not available in this context
        'permit_simulation',
        false,
        new Error(`Permit expired ${now - expiry} seconds ago for ${logMessage}`),
      )
      return { error: EcoError.PermitExpired }
    }

    return {}
  }

  getPermitCalls(permits: Permit2Params[]): Call[] {
    const calls = permits.map((permit) => {
      return {
        address: permit.permit2Address,
        abi: Permit2Abi,
        functionName: 'permit',
        args: [permit.owner, permit.spender, permit.sigDeadline, permit.details, permit.signature],
        account: permit.owner,
      }
    })

    return calls
  }
}
