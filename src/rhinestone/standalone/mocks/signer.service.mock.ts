import { Injectable, Logger } from '@nestjs/common'
import { privateKeyToAccount, PrivateKeyAccount } from 'viem/accounts'
import { Hex } from 'viem'

@Injectable()
export class MockSignerService {
  private readonly logger = new Logger(MockSignerService.name)
  private readonly account: PrivateKeyAccount

  constructor() {
    // Use test private key from environment
    const privateKey = process.env.SIGNER_PRIVATE_KEY as Hex
    if (!privateKey) {
      throw new Error('SIGNER_PRIVATE_KEY environment variable is required')
    }
    this.account = privateKeyToAccount(privateKey)
    this.logger.log(`MockSignerService initialized with address: ${this.account.address}`)
  }

  getAccount(): PrivateKeyAccount {
    return this.account
  }

  getSigner(): PrivateKeyAccount {
    return this.account
  }

  async signMessage(message: string): Promise<Hex> {
    this.logger.log(`Signing message: ${message}`)
    return this.account.signMessage({ message })
  }

  async signTypedData(typedData: any): Promise<Hex> {
    this.logger.log(`Signing typed data:`, typedData)
    return this.account.signTypedData(typedData)
  }
}
