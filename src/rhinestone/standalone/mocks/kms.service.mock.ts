import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Hex, getAddress as viemGetAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * Mock KMS Service for standalone Rhinestone module testing
 * Uses a local private key instead of AWS KMS
 */
@Injectable()
export class MockKmsService implements OnModuleInit {
  private logger = new Logger(MockKmsService.name)
  private keyID: string = 'mock-key-id'
  private privateKey: Hex
  wallets: any
  signer: any

  constructor() {
    // Use the same private key as the wallet client mock for consistency
    this.privateKey = process.env.SIGNER_PRIVATE_KEY as Hex
  }

  async onModuleInit() {
    const account = privateKeyToAccount(this.privateKey)

    // Mock the wallets object with minimal required functionality
    this.wallets = {
      getAddressHex: async (keyId: string) => {
        if (keyId !== this.keyID) {
          throw new Error(`Unknown key ID: ${keyId}`)
        }
        return account.address
      },
    }

    // Mock the signer object
    this.signer = {
      sign: async (message: any) => {
        return account.signMessage({ message })
      },
      signTransaction: async (tx: any) => {
        return account.signTransaction(tx)
      },
    }

    this.logger.log(`MockKmsService initialized with address: ${account.address}`)
  }

  /**
   * Returns the address as hex of the mock signer
   */
  async getAddress(): Promise<Hex> {
    const address = await this.wallets.getAddressHex(this.keyID)
    return viemGetAddress(address)
  }

  /**
   * Returns the mock KMS key ID
   */
  getKmsKeyId(): string {
    return this.keyID
  }
}
