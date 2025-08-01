import { Injectable } from '@nestjs/common'
import { PublicClient, Hash, Hex } from 'viem'

@Injectable()
export class MockMultichainPublicClientService {
  private mockClient: any

  constructor() {
    // Create a mock client that implements the necessary methods
    this.mockClient = {
      chain: { id: 10 },
      multicall: async ({ contracts }: any) => {
        // Return mock results for each contract call
        return contracts.map((contract: any) => {
          if (contract.functionName === 'balanceOf') {
            return { result: BigInt('1000000000000000000') } // 1 ETH worth
          }
          if (contract.functionName === 'decimals') {
            return { result: 6 }
          }
          if (contract.functionName === 'symbol') {
            return { result: 'MOCK' }
          }
          return { result: null }
        })
      },
      getBalance: async ({ address }: { address: Hex }) => {
        return BigInt('1000000000000000000') // 1 ETH
      },
      getBlockNumber: async () => {
        return BigInt(1000000)
      },
      getBlock: async () => {
        return {
          number: BigInt(1000000),
          timestamp: BigInt(Math.floor(Date.now() / 1000)),
        }
      },
      getTransaction: async (hash: Hash) => {
        return {
          hash,
          blockNumber: BigInt(1000000),
        }
      },
      readContract: async ({ abi, address, functionName, args }: any) => {
        // Mock responses for rhinestone router contract calls
        if (functionName === '$claimAdapters' || functionName === 'getFillAdapter') {
          // Return mock adapter address
          return '0xa0de4A8e033FBceC2BFa708FaD59e1587839b4Ca' as Hex
        }
        if (functionName === 'getArbiter') {
          // Return mock arbiter address
          return '0x0000000000814Cf877224D19919490d4761B0C86' as Hex
        }
        if (functionName === 'CLAIMHASH_ORACLE') {
          // Return mock oracle address
          return '0x000000000004598d17aad017bf0734a364c5588b' as Hex
        }
        // Default return for any other function
        return '0x0000000000814Cf877224D19919490d4761B0C86' as Hex
      },
    }
  }

  async getClient(chainId: number): Promise<PublicClient> {
    return this.mockClient as PublicClient
  }
}
