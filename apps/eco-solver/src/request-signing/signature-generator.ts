// eslint-disable-next-line
const canonicalize = require('canonicalize')
import { DOMAIN, TYPES } from '@eco-solver/request-signing/typed-data'
import { Injectable } from '@nestjs/common'
import { LocalAccount } from 'viem'
import { SignatureHeaders } from '@eco-solver/request-signing/interfaces/signature-headers.interface'
import { SignedMessage } from '@eco-solver/request-signing/interfaces/signed-message.interface'

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
