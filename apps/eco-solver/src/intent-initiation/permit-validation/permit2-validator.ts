import { Call } from '@eco-solver/intent-initiation/permit-validation/interfaces/call.interface'
import { EcoError } from '@eco-solver/common/errors/eco-error'
import { EcoLogger } from '@eco-solver/common/logging/eco-logger'
import { EcoLogMessage } from '@eco-solver/common/logging/eco-log-message'
import { EcoResponse } from '@eco-solver/common/eco-response'
import { Permit2Abi } from '@eco-solver/contracts/Permit2.abi'
import { Permit2Params } from '@eco-solver/intent-initiation/permit-validation/interfaces/permit2-params.interface'
import { PublicClient, verifyTypedData } from 'viem'

const KNOWN_PERMIT2_ADDRESSES = new Set(
  ['0x000000000022D473030F116dDEE9F6B43aC78BA3'].map((addr) => addr.toLowerCase()),
)

export class Permit2Validator {
  private static logger = new EcoLogger(Permit2Validator.name)

  static async validatePermits(
    client: PublicClient,
    chainId: number,
    permits: Permit2Params[],
  ): Promise<EcoResponse<void>> {
    for (const permit of permits) {
      const { error } = await this.validatePermit(client, chainId, permit)

      if (error) {
        return { error }
      }
    }

    return {}
  }

  static async validatePermit(
    client: PublicClient,
    chainId: number,
    permit: Permit2Params,
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

  static validatePermitAddress(permit: Permit2Params): EcoResponse<void> {
    const { permit2Address } = permit

    if (!KNOWN_PERMIT2_ADDRESSES.has(permit2Address.toLowerCase())) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Permit2 address not whitelisted: ${permit2Address}`,
        }),
      )

      return { error: EcoError.InvalidPermit2Address }
    }

    return {}
  }

  static async validatePermitSignature(
    chainId: number,
    permit: Permit2Params,
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
      return { error: EcoError.InvalidPermitSignature }
    }

    return {}
  }

  static async validateNonces(
    client: PublicClient,
    permit: Permit2Params,
  ): Promise<EcoResponse<void>> {
    const { permit2Address, owner, spender, details } = permit

    this.logger.error(
      EcoLogMessage.fromDefault({
        message: `validateNonces`,
        properties: {
          permit,
        },
      }),
    )

    for (const detail of details) {
      const { nonce: expectedNonce, token } = detail

      const [amount, onchainExpiration, actualNonce] = await client.readContract({
        address: permit2Address,
        abi: Permit2Abi,
        functionName: 'allowance',
        args: [owner, token, spender],
      })

      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `validateNonces`,
          properties: {
            amount,
            onchainExpiration,
            actualNonce,
          },
        }),
      )

      if (BigInt(actualNonce) !== expectedNonce) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `⛔ Nonce mismatch for token ${token}`,
          }),
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
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `⚠️ On-chain expiration is earlier than signed expiration`,
          }),
        )

        return { error: EcoError.PermitExpirationMismatch }
      }
    }

    return {}
  }

  static expirationCheck(expiration: number | bigint, logMessage: string): EcoResponse<void> {
    const now = Math.floor(Date.now() / 1000)
    const expiry = typeof expiration === 'bigint' ? Number(expiration) : expiration

    if (expiry < now) {
      this.logger.warn(
        EcoLogMessage.fromDefault({
          message: `⏰ Permit expired ${now - expiry} seconds ago for ${logMessage}`,
        }),
      )

      return { error: EcoError.PermitExpired }
    }

    return {}
  }

  static getPermitCalls(permits: Permit2Params[]): Call[] {
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
