// eslint-disable-next-line @typescript-eslint/no-var-requires
const canonicalize = require('canonicalize');
import { Injectable, Logger } from '@nestjs/common';

import { Hex, recoverTypedDataAddress } from 'viem';

import { EcoResponse } from '@/common/eco-response';
import { EcoLogMessage } from '@/common/logging/eco-log-message';
import { EcoError } from '@/errors/eco-error';
import { DOMAIN, TYPES } from '@/request-signing/typed-data';

@Injectable()
export class SignatureVerificationService {
  private readonly logger = new Logger(SignatureVerificationService.name);

  async verifySignature(
    payload: object,
    signature: Hex,
    expiryTime: string | number,
    claimedAddress: string,
  ): Promise<EcoResponse<string>> {
    const nowMs = Date.now();
    const expiryTimeNumMs = this.getExpiryTime(expiryTime);

    if (isNaN(expiryTimeNumMs) || expiryTimeNumMs < nowMs) {
      return { error: EcoError.SignatureExpired };
    }

    const { response: recoveredAddress, error: verifyDataError } = await this.verifyTypedData(
      payload,
      signature,
      expiryTime,
    );

    if (verifyDataError) {
      return { error: verifyDataError };
    }

    if (recoveredAddress!.toLowerCase() !== claimedAddress.toLowerCase()) {
      return { error: EcoError.InvalidSignature };
    }

    return { response: recoveredAddress };
  }

  private async verifyTypedData(
    payload: object,
    signature: Hex,
    expiryTime: string | number,
  ): Promise<EcoResponse<string>> {
    try {
      const canonicalPayload = canonicalize(payload);
      if (typeof canonicalPayload !== 'string') {
        throw new Error('Failed to canonicalize payload for signing');
      }

      const recoveredAddress = await recoverTypedDataAddress({
        domain: DOMAIN,
        types: TYPES,
        primaryType: 'Registration',
        message: {
          payload: canonicalPayload,
          expiryTime: this.getExpiryTime(expiryTime),
        },
        signature,
      });

      return { response: recoveredAddress };
    } catch (ex) {
      const errorMessage = EcoError.getErrorMessage(ex);

      this.logger.error(
        EcoLogMessage.fromDefault({
          message: `verifyTypedData: error`,
          properties: {
            error: errorMessage,
          },
        }),
      );

      return { error: EcoError.TypedDataVerificationFailed(errorMessage) };
    }
  }

  getExpiryTime(expiryTime: string | number): number {
    const parsed = typeof expiryTime === 'string' ? parseInt(expiryTime, 10) : expiryTime;
    const expiryMs = Number.isFinite(parsed) ? parsed : NaN;

    return expiryMs;
  }
}
