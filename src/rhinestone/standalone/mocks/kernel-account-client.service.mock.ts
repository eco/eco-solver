import { Injectable, Logger } from '@nestjs/common'
import { Hash, Hex } from 'viem'
import { ExecuteSmartWalletArg } from '@/transaction/smart-wallets/smart-wallet.types'

// Mock implementation of execute method
async function mockExecute(transactions: ExecuteSmartWalletArg[]): Promise<Hash> {
  // Return a mock transaction hash
  const timestamp = Date.now()
  const txCount = transactions.length
  return `0x${Buffer.from(`mock-kernel-tx-${timestamp}-${txCount}`).toString('hex').padEnd(64, '0')}` as Hash
}

// Mock client object
class MockKernelClient {
  kernelAccount = {
    address: '0x1234567890123456789012345678901234567890' as Hex,
  }

  async multicall({ contracts }: any) {
    // Return mock results for each contract call
    return contracts.map((contract: any) => {
      if (contract.functionName === 'balanceOf') {
        return BigInt('1000000000000000000') // 1 ETH worth
      }
      if (contract.functionName === 'decimals') {
        return 6
      }
      if (contract.functionName === 'symbol') {
        return 'MOCK'
      }
      return null
    })
  }

  async execute(transactions: ExecuteSmartWalletArg[]): Promise<Hash> {
    return mockExecute(transactions)
  }
}

@Injectable()
export class MockKernelAccountClientService {
  private readonly logger = new Logger(MockKernelAccountClientService.name)
  private clients: Map<number, MockKernelClient> = new Map()

  constructor() {
    this.logger.log('MockKernelAccountClientService initialized')
  }

  async getClient(chainId: number): Promise<MockKernelClient> {
    if (!this.clients.has(chainId)) {
      this.clients.set(chainId, new MockKernelClient())
    }
    return this.clients.get(chainId)!
  }

  async getAddress(): Promise<Hex> {
    // Return a mock kernel account address
    return '0x1234567890123456789012345678901234567890'
  }

  async estimateGasForKernelExecution(
    chainId: number,
    transactions: ExecuteSmartWalletArg[],
  ): Promise<any> {
    this.logger.log(
      `Mock gas estimation for ${transactions.length} transactions on chain ${chainId}`,
    )
    return {
      response: {
        gasEstimate: 200000n,
        gasPrice: 20000000000n, // 20 gwei
      },
    }
  }
}
