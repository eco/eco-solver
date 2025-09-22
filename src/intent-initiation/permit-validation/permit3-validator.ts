import { Address, Hex, verifyTypedData } from 'viem'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'

// Typed data for EIP-712 signature verification
const types = {
  Permit3: [
    { name: 'owner', type: 'address' },
    { name: 'salt', type: 'bytes32' },
    { name: 'deadline', type: 'uint48' },
    { name: 'timestamp', type: 'uint48' },
    { name: 'merkleRoot', type: 'bytes32' },
  ],
}

export interface Permit3Params {
  owner: Hex
  salt: Hex
  deadline: number | bigint // uint48
  timestamp: number | bigint // uint48
  merkleRoot: Hex
  signature: Hex
  permitContract: Hex // optional if domain is passed separately
}

export class Permit3Validator {
  private static logger = new EcoLogger(Permit3Validator.name)

  static async validatePermits(permits: Permit3Params[]): Promise<EcoResponse<void>> {
    for (const permit of permits) {
      const { error } = await this.validatePermit(permit)

      if (error) {
        return { error }
      }
    }

    return {}
  }

  static async validatePermit(permit: Permit3Params): Promise<EcoResponse<void>> {
    const { owner, salt, deadline, timestamp, merkleRoot, signature, permitContract } = permit

    // Basic expiration check
    const { error: expirationError } = this.expirationCheck(deadline, `deadline`)

    if (expirationError) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Permit3 expirationError check failed`,
          properties: {
            deadline,
          },
        }),
      )
      return { error: expirationError }
    }

    try {
      const validSig = await verifyTypedData({
        address: owner.toLowerCase() as Address,
        domain: {
          name: 'Permit3',
          version: '1',
          chainId: 1,
          verifyingContract: permitContract.toLowerCase() as Address,
        },
        types,
        primaryType: 'Permit3',
        message: {
          owner: owner.toLowerCase() as Address,
          salt,
          deadline: BigInt(deadline),
          timestamp: Number(timestamp),
          merkleRoot,
        },
        signature,
      })

      if (!validSig) {
        this.logger.error(
          EcoLogMessage.fromDefault({
            message: `Permit3 signature verification failed`,
            properties: { permit },
          }),
        )
        return { error: EcoError.InvalidPermitSignature }
      }

      return {}
    } catch (err) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Permit3 signature validation threw`,
          properties: {
            error: err instanceof Error ? err.message : String(err),
            permit,
          },
        }),
      )
      return { error: EcoError.InvalidPermitSignature }
    }
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
}
