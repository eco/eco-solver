import { Injectable, OnModuleInit } from '@nestjs/common'
import { PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { Hex } from 'viem'
import { KmsService } from '@/kms/kms.service'

/**
 * Mock SignerKmsService for standalone Rhinestone module testing
 * Returns a PrivateKeyAccount instead of a KmsAccount
 */
@Injectable()
export class MockSignerKmsService implements OnModuleInit {
  private account: PrivateKeyAccount

  constructor(readonly kmsService: KmsService) {}

  async onModuleInit() {
    this.account = await this.buildAccount()
  }

  getAccount() {
    return this.account
  }

  protected async buildAccount(): Promise<PrivateKeyAccount> {
    // Use the same private key as configured in the mock KMS service
    const privateKey = process.env.SIGNER_PRIVATE_KEY as Hex

    return privateKeyToAccount(privateKey)
  }
}
