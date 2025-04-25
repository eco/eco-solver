/* eslint-disable @typescript-eslint/no-var-requires */
const canonicalize = require('canonicalize')
import { createWalletClient, http, WalletClient } from 'viem'
import { DOMAIN, TYPES } from '@/request-signing/typed-data'
import { Hex, HttpTransport } from 'viem'
import { Injectable } from '@nestjs/common'
import { mainnet } from 'viem/chains'
import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface'
import { SignedMessage } from '@/request-signing/interfaces/signed-message.interface'

@Injectable()
export class SignatureGenerator {
  getWalletClient(privateKey: Hex): WalletClient<HttpTransport, typeof mainnet, PrivateKeyAccount> {
    const account = privateKeyToAccount(privateKey)

    const untypedClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    })

    return untypedClient as WalletClient<HttpTransport, typeof mainnet, PrivateKeyAccount>
  }

  async signPayload(
    walletClient: WalletClient<any, any, PrivateKeyAccount>,
    payload: object,
    expiryTime: number,
  ): Promise<SignedMessage> {
    const canonicalPayload = canonicalize(payload)
    const signature = await walletClient.signTypedData({
      account: walletClient.account,
      domain: DOMAIN,
      types: TYPES,
      primaryType: 'Registration',
      message: {
        payload: canonicalPayload,
        expiryTime,
      },
    })
    return { signature, expiryTime }
  }

  async getHeaders(
    privateKey: Hex,
    payload: object,
    expiryTime: number,
  ): Promise<SignatureHeaders> {
    return this.getHeadersWithWalletClient(this.getWalletClient(privateKey), payload, expiryTime)
  }

  async getHeadersWithWalletClient(
    walletClient: WalletClient<any, any, PrivateKeyAccount>,
    payload: object,
    expiryTime: number,
  ): Promise<SignatureHeaders> {
    const { signature } = await this.signPayload(walletClient, payload, expiryTime)

    return {
      'x-beam-sig': signature,
      'x-beam-sig-expire': expiryTime,
      'x-beam-sig-address': walletClient.account.address,
    }
  }
}
