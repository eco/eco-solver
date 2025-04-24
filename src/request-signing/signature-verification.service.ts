/* eslint-disable @typescript-eslint/no-var-requires */
const canonicalize = require('canonicalize')
import { hashMessage, recoverAddress, Hex } from 'viem'
import { Injectable } from '@nestjs/common'

const DOMAIN_SEPARATOR = 'eco:solver-registration'

@Injectable()
export class SignatureVerificationService {
  async verifySignature(
    payload: object,
    signature: Hex,
    expiryTime: string | number,
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    const expiry = typeof expiryTime === 'string' ? parseInt(expiryTime, 10) : expiryTime

    if (isNaN(expiry) || expiry < now) {
      throw new Error('Signature expired or invalid timestamp')
    }

    const canonicalPayload = canonicalize(payload)
    const dataToVerify = `${DOMAIN_SEPARATOR}:${canonicalPayload}:${expiry}`
    const messageHash = hashMessage(dataToVerify)

    const recoveredAddress = await recoverAddress({
      hash: messageHash,
      signature,
    })

    return recoveredAddress
  }
}
