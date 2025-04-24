/* eslint-disable @typescript-eslint/no-var-requires */
const canonicalize = require('canonicalize')
import { createWalletClient, Hex, http, WalletClient } from 'viem'
import { HttpTransport } from 'viem'
import { Injectable } from '@nestjs/common'
import { mainnet } from 'viem/chains'
import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface'
import { SignedMessage } from '@/request-signing/interfaces/signed-message.interface'

const DOMAIN_SEPARATOR = 'eco:solver-registration'

@Injectable()
export class SignatureGenerator {
  // async getHeaders(
  //   privateKey: Hex,
  //   payload: object,
  //   expiryTime: number,
  // ): Promise<SignatureHeaders> {
  //   const walletClient = this.getWalletClient(privateKey)
  //   const signatureValidationData = await this.signPayload(walletClient, payload, expiryTime)

  //   return {
  //     'x-beam-sig': signatureValidationData.signature,
  //     'x-beam-sig-expire': signatureValidationData.expiryTime,
  //   }
  // }

  async getHeaders(
    walletClient: WalletClient<HttpTransport, typeof mainnet, PrivateKeyAccount>,
    payload: object,
    expiryTime: number,
  ): Promise<SignatureHeaders> {
    const signatureValidationData = await this.signPayload(walletClient, payload, expiryTime)

    return {
      'x-beam-sig': signatureValidationData.signature,
      'x-beam-sig-expire': signatureValidationData.expiryTime,
    }
  }

  async signPayload(
    walletClient: WalletClient<HttpTransport, typeof mainnet, PrivateKeyAccount>,
    payload: object,
    expiryTime: number,
  ): Promise<SignedMessage> {
    const canonicalPayload = canonicalize(payload)
    const dataToSign = `${DOMAIN_SEPARATOR}:${canonicalPayload}:${expiryTime}`

    const signature = await walletClient.signMessage({
      account: walletClient.account,
      message: dataToSign,
    })

    return { signature, expiryTime }
  }

  getWalletClient(privateKey: Hex): WalletClient<HttpTransport, typeof mainnet, PrivateKeyAccount> {
    const account = privateKeyToAccount(privateKey)

    const untypedClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    })

    return untypedClient as WalletClient<HttpTransport, typeof mainnet, PrivateKeyAccount>
  }
}
