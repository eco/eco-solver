import { Account } from 'viem'
import { KmsService } from '@/kms/kms.service'
import { kmsToAccount } from '@/sign/kms-account/kmsToAccount'
import { Injectable, OnModuleInit } from '@nestjs/common'
import { SignerService } from '@/sign/signer.service'

/**
 * A signer service that creates a {@link KmsAccount} from a KMS signer.
 * Uses the {@link KmsService} to get the KMS signer from aws.
 */
@Injectable()
export class SignerKmsService implements OnModuleInit {
  private account: Account

  constructor(
    readonly kmsService: KmsService,
    readonly signerService: SignerService,
  ) {}

  async onModuleInit() {
    this.account = await this.buildAccount()
  }

  getAccount() {
    return this.account
  }

  protected async buildAccount(): Promise<Account> {
    if (!this.kmsService.enabled) return this.signerService.buildAccount()

    return await kmsToAccount(this.kmsService.signer, this.kmsService.wallets, {
      keyID: this.kmsService.getKmsKeyId(),
    })
  }
}
