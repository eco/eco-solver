import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { HttpTransport } from 'viem'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { mainnet } from 'viem/chains'
import { PrivateKeyAccount } from 'viem/accounts'
import { SignatureGenerator } from '@/request-signing/signature-generator'
import { SignedMessage } from '@/request-signing/interfaces/signed-message.interface'
import { WalletClient } from 'viem'
import { SignatureHeaders } from '@/request-signing/interfaces/signature-headers.interface'

@Injectable()
export class SigningService implements OnModuleInit {
  private requestSignerConfig: any
  private walletClient: WalletClient<HttpTransport, typeof mainnet, PrivateKeyAccount>

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly signatureGenerator: SignatureGenerator,
  ) {}

  onModuleInit() {
    // this.requestSignerConfig = this.ecoConfigService.getRequestSignerConfig()
    // const privateKey = this.requestSignerConfig.privateKey as Hex
    // const address = '0xc3dD6EB9cd9683c3dd8B3d48421B3d5404FeedAC'
    // TODO: Use the private key from the config
    const privateKey = '0xae647e8ce1871eb6555401960e710b5957c3462c354f80c2d840845a40a17ac9'
    this.walletClient = this.signatureGenerator.getWalletClient(privateKey)
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
