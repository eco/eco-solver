import { Injectable, OnModuleInit } from '@nestjs/common'
import { LocalAccount } from 'viem/accounts'
import { SignatureGenerator } from './signature-generator'
import { SignatureHeaders } from './interfaces/signature-headers.interface'
import { SignedMessage } from './interfaces/signed-message.interface'
import { SignerService } from '../signing/signer.service'

@Injectable()
export class SigningService implements OnModuleInit {
  private walletAccount!: LocalAccount

  constructor(
    private readonly signatureGenerator: SignatureGenerator,
    private readonly signerService: SignerService,
  ) {}

  onModuleInit() {
    this.walletAccount = this.signerService.getAccount() as LocalAccount
  }

  getAccountAddress() {
    return this.walletAccount.address
  }

  async getHeaders(payload: object, expiryTime: number): Promise<SignatureHeaders> {
    return this.signatureGenerator.getHeadersWithWalletClient(
      this.walletAccount,
      payload,
      expiryTime,
    )
  }

  async signPayload(payload: object, expiryTime: number): Promise<SignedMessage> {
    return this.signatureGenerator.signPayload(this.walletAccount, payload, expiryTime)
  }
}
