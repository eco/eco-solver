// eslint-disable-next-line
const canonicalize = require('canonicalize')

import { Injectable } from '@nestjs/common'
import { LocalAccount } from 'viem'
import { DOMAIN, TYPES } from '@/request-signing/typed-data'
import { SignedMessage } from '@/request-signing/interfaces/signed-message.interface'
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface'

@Injectable()
export class SignatureGenerator {
  async signPayload(
    walletAccount: LocalAccount,
    payload: object,
    expiryTime: number,
  ): Promise<SignedMessage> {
    const canonicalPayload = canonicalize(payload)
    const signature = await walletAccount.signTypedData({
      domain: DOMAIN,
      types: TYPES,
      primaryType: 'Registration',
      message: { payload: canonicalPayload, expiryTime },
    })
    return { signature, expiryTime }
  }

  async getHeadersWithWalletClient(
    walletAccount: LocalAccount,
    payload: object,
    expiryTime: number,
  ): Promise<SignatureHeaders> {
    const { signature } = await this.signPayload(walletAccount, payload, expiryTime)

    return {
      'x-beam-sig': signature,
      'x-beam-sig-expire': expiryTime,
      'x-beam-sig-address': walletAccount.address,
    }
  }
}
