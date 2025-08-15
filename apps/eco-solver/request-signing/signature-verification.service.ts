/* eslint-disable @typescript-eslint/no-var-requires */
const canonicalize = require('canonicalize')
import { DOMAIN, TYPES } from '@/request-signing/typed-data'
import { EcoError } from '@/common/errors/eco-error'
import { EcoLogMessage } from '@eco/infrastructure-logging'
import { EcoResponse } from '@/common/eco-response'
import { Injectable, Logger } from '@nestjs/common'
import { recoverTypedDataAddress, Hex } from 'viem'

@Injectable()
export class SignatureVerificationService {
  private readonly logger = new Logger(SignatureVerificationService.name)

  async verifySignature(
    payload: object,
    signature: Hex,
    expiryTime: string | number,
    claimedAddress: string,
  ): Promise<EcoResponse<string>> {
    const now = Date.now()
    const expiry = typeof expiryTime === 'string' ? parseInt(expiryTime, 10) : expiryTime

    if (isNaN(expiry) || expiry < now) {
      return { error: EcoError.SignatureExpired }
    }

    const { response: recoveredAddress, error: verifyDataError } = await this.verifyTypedData(
      payload,
      signature,
      expiryTime,
    )

    if (verifyDataError) {
      return { error: verifyDataError }
    }

    if (recoveredAddress!.toLowerCase() !== claimedAddress.toLowerCase()) {
      return { error: EcoError.InvalidSignature }
    }

    return { response: recoveredAddress }
  }

  private async verifyTypedData(
    payload: object,
    signature: Hex,
    expiryTime: string | number,
  ): Promise<EcoResponse<string>> {
    try {
      const canonicalPayload = canonicalize(payload)

      const recoveredAddress = await recoverTypedDataAddress({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Registration',
        message: {
          payload: canonicalPayload,
          expiryTime,
        },
        signature,
      })

      return { response: recoveredAddress }
    } catch (ex) {
      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `verifyTypedData: error`,
          properties: {
            error: EcoError.getErrorMessage(ex),
          },
        }),
      )

      return { error: EcoError.TypedDataVerificationFailed }
    }
  }
}
