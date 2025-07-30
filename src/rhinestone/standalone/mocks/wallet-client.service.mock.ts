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
    if (!privateKey) {
      throw new Error('SIGNER_PRIVATE_KEY environment variable is required')
    }
    this.account = privateKeyToAccount(privateKey)
    this.logger.log(`MockWalletClientService initialized with address: ${this.account.address}`)
  }

  async getClient(chainId: number): Promise<WalletClient> {
    if (!this.walletClients.has(chainId)) {
      const chain = SUPPORTED_CHAINS[chainId] || mainnet
      const transport = http(process.env[`RPC_URL_${chainId}`])

      const client = createWalletClient({
        account: this.account,
        chain,
        transport,
      })

      this.walletClients.set(chainId, client)
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
