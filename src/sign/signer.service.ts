import { Injectable, OnModuleInit } from '@nestjs/common'
import { EcoConfigService } from '../eco-configs/eco-config.service'
import { Hex, PrivateKeyAccount } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

@Injectable()
export class SignerService implements OnModuleInit {
  private account: PrivateKeyAccount
  constructor(readonly ecoConfigService: EcoConfigService) {}

  async onModuleInit() {
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
