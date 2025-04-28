import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { Chain, Transport, WalletClient } from 'viem'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { mainnet } from 'viem/chains'
import { PrivateKeyAccount } from 'viem/accounts'
import { SignatureGenerator } from '@/request-signing/signature-generator'
import { SignedMessage } from '@/request-signing/interfaces/signed-message.interface'
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface'
import { WalletClientDefaultSignerService } from '@/transaction/smart-wallets/wallet-client.service'

@Injectable()
export class SigningService implements OnModuleInit {
  private requestSignerConfig: any
  private walletClient: WalletClient<Transport, Chain, PrivateKeyAccount>

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly walletClientService: WalletClientDefaultSignerService,
    private readonly signatureGenerator: SignatureGenerator,
  ) {}

  async onModuleInit() {
    this.walletClient = await this.walletClientService.getClient(mainnet.id)
  }

  getAccountAddress(): string {
    return this.walletClient.account.address
  }

  async getHeaders(payload: object, expiryTime: number): Promise<SignatureHeaders> {
    return this.signatureGenerator.getHeaders(this.walletClient, payload, expiryTime)
  }

  async signPayload(payload: object, expiryTime: number): Promise<SignedMessage> {
    return this.signatureGenerator.signPayload(this.walletClient, payload, expiryTime)
  }
}
