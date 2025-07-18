import { Injectable, Logger } from '@nestjs/common'
import { privateKeyToAccount, PrivateKeyAccount } from 'viem/accounts'
import { Hex } from 'viem'

@Injectable()
export class MockSignerService {
  private readonly logger = new Logger(MockSignerService.name)
  private readonly account: PrivateKeyAccount

  constructor() {
    // Use test private key from environment or default
    const privateKey = process.env.SIGNER_PRIVATE_KEY
    this.account = privateKeyToAccount(privateKey as Hex)
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
