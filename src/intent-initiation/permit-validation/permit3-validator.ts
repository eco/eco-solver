import { Address, Hex, verifyTypedData } from 'viem'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogger } from '@/common/logging/eco-logger'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { EcoResponse } from '@/common/eco-response'

const types = {
  SignedUnhingedPermit3: [
    { name: 'owner', type: 'address' },
    { name: 'salt', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' },
    { name: 'timestamp', type: 'uint48' },
    { name: 'unhingedRoot', type: 'bytes32' },
  ],
} as const

export interface Permit3Params {
  owner: Hex
  salt: Hex
  deadline: number | bigint
  timestamp: number | bigint
  unhingedRoot: Hex
  signature: Hex
  permitContract: Hex // optional, if not used in domain
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
    const { owner, signature, permitContract, salt, deadline, timestamp, unhingedRoot } = permit

    // Basic expiration check
    const { error: expirationError } = this.expirationCheck(deadline, `deadline`)

    if (expirationError) {
      return { error: expirationError }
    }

    const verificationData = {
      domain: {
        name: 'Permit3',
        version: '1',
        chainId: 1,
        verifyingContract: permitContract.toLowerCase() as Address,
      },
      types,
      primaryType: 'SignedUnhingedPermit3',
      message: {
        owner: owner.toLowerCase() as Address,
        salt,
        deadline: BigInt(deadline),
        timestamp: Number(timestamp),
        unhingedRoot,
      },
      signature,
    } as any

    const validSig = await verifyTypedData({
      address: permit.owner.toLowerCase() as Address,
      ...verificationData,
    })

    if (!validSig) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `Permit3 signature verification failed`,
        }),
      )
      return { error: EcoError.InvalidPermitSignature }
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
}
