// eslint-disable-next-line @typescript-eslint/no-var-requires
const canonicalize = require('canonicalize');
import { Injectable } from '@nestjs/common';

import { LocalAccount } from 'viem';

import { SignedMessage } from '@/request-signing/interfaces/signed-message.interface';
import { getSignatureHeaders, SignatureHeaders } from '@/request-signing/signature-headers';
import { DOMAIN, TYPES } from '@/request-signing/typed-data';

@Injectable()
export class SignatureGenerator {
  async signPayload(
    walletAccount: LocalAccount,
    payload: object,
    expiryTime: number,
  ): Promise<SignedMessage> {
    const canonicalPayload = canonicalize(payload);
    if (typeof canonicalPayload !== 'string') {
      throw new Error('Failed to canonicalize payload for signing');
    }

    const signature = await walletAccount.signTypedData({
      domain: DOMAIN,
      types: TYPES,
      primaryType: 'Registration',
      message: { payload: canonicalPayload, expiryTime },
    });
    return { signature, expiryTime };
  }

  async getHeadersWithWalletClient(
    walletAccount: LocalAccount,
    payload: object,
    expiryTime: number,
  ): Promise<SignatureHeaders> {
    const { signature } = await this.signPayload(walletAccount, payload, expiryTime);

    return getSignatureHeaders(signature, walletAccount.address, expiryTime);
  }
}
