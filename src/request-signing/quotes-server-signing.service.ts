import { LocalAccount } from 'viem'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { SignatureGenerator } from '@/request-signing/signature-generator'
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface'
import { SignedMessage } from '@/request-signing/interfaces/signed-message.interface'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

@Injectable()
export class QuotesServerSigningService implements OnModuleInit {
  private walletAccount: LocalAccount

  constructor(
    private readonly signatureGenerator: SignatureGenerator,
    private readonly walletClientDefaultSignerService: WalletClientDefaultSignerService,
  ) {}

  async onModuleInit() {
    this.walletAccount = await this.walletClientDefaultSignerService.getAccount()
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
