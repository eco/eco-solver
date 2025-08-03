import { Injectable, Logger } from '@nestjs/common'
import {
  Hash,
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
  WalletClient,
  Chain,
  Hex,
} from 'viem'
import { privateKeyToAccount, PrivateKeyAccount } from 'viem/accounts'
import { mainnet, arbitrum, optimism, base, polygon } from 'viem/chains'

const SUPPORTED_CHAINS: Record<number, Chain> = {
  1: mainnet,
  10: optimism,
  137: polygon,
  8453: base,
  42161: arbitrum,
}

@Injectable()
export class MockWalletClientService {
  private readonly logger = new Logger(MockWalletClientService.name)
  private readonly account: PrivateKeyAccount
  private walletClients: Map<number, WalletClient> = new Map()
  private publicClients: Map<number, PublicClient> = new Map()

  constructor() {
    // Use test private key from mock config
    const privateKey = process.env.SIGNER_PRIVATE_KEY as Hex
    this.account = privateKeyToAccount(privateKey)
    this.logger.log(`MockWalletClientService initialized with address: ${this.account.address}`)
  }

  async getClient(chainId: number): Promise<WalletClient> {
    if (!this.walletClients.has(chainId)) {
      const chain = SUPPORTED_CHAINS[chainId] || mainnet
      
      // Create a mock wallet client
      const mockClient = {
        account: this.account,
        chain,
        transport: { type: 'http' },
        sendTransaction: async (args: any) => {
          this.logger.log(`Mock sendTransaction called with:`, args)
          // Return a mock transaction hash
          return `0x${Buffer.from(`mock-tx-${Date.now()}`).toString('hex').padEnd(64, '0')}` as Hash
        },
        writeContract: async (args: any) => {
          this.logger.log(`Mock writeContract called with:`, args)
          return `0x${Buffer.from(`mock-write-${Date.now()}`).toString('hex').padEnd(64, '0')}` as Hash
        },
        deployContract: async (args: any) => {
          this.logger.log(`Mock deployContract called with:`, args)
          return `0x${Buffer.from(`mock-deploy-${Date.now()}`).toString('hex').padEnd(64, '0')}` as Hash
        },
        signMessage: async (args: any) => {
          return '0x' + 'a'.repeat(130) as Hex // Mock signature
        },
        signTypedData: async (args: any) => {
          return '0x' + 'b'.repeat(130) as Hex // Mock signature
        },
      } as any

      this.walletClients.set(chainId, mockClient)
    }

    return this.walletClients.get(chainId)!
  }

  async getPublicClient(chainId: number): Promise<PublicClient> {
    if (!this.publicClients.has(chainId)) {
      const chain = SUPPORTED_CHAINS[chainId] || mainnet
      const transport = http(process.env[`RPC_URL_${chainId}`])

      const client = createPublicClient({
        chain,
        transport,
      })

      this.publicClients.set(chainId, client)
    }

    return this.publicClients.get(chainId)!
  }

  getAccount(): PrivateKeyAccount {
    return this.account
  }

  // Mock transaction execution - in real environment this would send to chain
  async sendTransaction(params: {
    chainId: number
    to: `0x${string}`
    value?: bigint
    data?: `0x${string}`
  }): Promise<Hash> {
    this.logger.log(`Mock transaction sent:`, {
      chainId: params.chainId,
      to: params.to,
      value: params.value?.toString(),
      data: params.data,
      from: this.account.address,
    })

    // Return a mock transaction hash
    return `0x${Buffer.from(`mock-tx-${Date.now()}`).toString('hex').padEnd(64, '0')}` as Hash
  }
}
