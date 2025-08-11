import { Injectable, OnModuleInit } from '@nestjs/common'
import { Hex, PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { IEcoConfigService } from '@libs/shared'

@Injectable()
export class SignerService implements OnModuleInit {
  private account: PrivateKeyAccount
  constructor(readonly ecoConfigService: IEcoConfigService) {}

  onModuleInit() {
    this.account = this.buildAccount()
  }

  getAccount() {
    return this.account
  }

  protected buildAccount(): PrivateKeyAccount {
    return privateKeyToAccount(this.getPrivateKey())
  }

  protected getPrivateKey(): Hex {
    return this.ecoConfigService.getEth().simpleAccount.signerPrivateKey
  }
}
