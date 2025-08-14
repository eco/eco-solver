import { KmsService } from '@/kms/kms.service'
import { KmsAccount, kmsToAccount } from '@/sign/kms-account/kmsToAccount'
import { Injectable, OnModuleInit } from '@nestjs/common'

/**
 * A signer service that creates a {@link KmsAccount} from a KMS signer.
 * Uses the {@link KmsService} to get the KMS signer from aws.
 */
@Injectable()
export class SignerKmsService implements OnModuleInit {
  private account!: KmsAccount
  constructor(readonly kmsService: KmsService) {}

  async onModuleInit() {
    this.account = await this.buildAccount()
  }

  getAccount() {
    return this.account
  }

  protected async buildAccount(): Promise<KmsAccount> {
    return await kmsToAccount(this.kmsService.signer, this.kmsService.wallets, {
      keyID: this.kmsService.getKmsKeyId(),
    })
  }
}
