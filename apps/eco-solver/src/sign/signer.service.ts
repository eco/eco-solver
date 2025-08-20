import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrivateKeyAccount } from 'viem'
import { Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { EcoConfigService } from '@libs/config-core'

@Injectable()
export class SignerService implements OnModuleInit {
  private account: PrivateKeyAccount
  constructor(readonly ecoConfigService: EcoConfigService) {}

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
