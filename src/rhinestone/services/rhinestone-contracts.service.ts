import { Inject, Injectable } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Address, Hex } from 'viem'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { ecoArbiterAbi } from '@/contracts/rhinestone/EcoArbiter'
import { ecoAdapterAbi } from '@/contracts/rhinestone/EcoAdapter'
import { rhinestoneRouterAbi } from '@/contracts/rhinestone/RhinestoneRouter'
import { Cacheable } from '@/decorators/cacheable.decorator'

/**
 * Service for interacting with Rhinestone smart contracts.
 * Provides cached access to contract read operations.
 */
@Injectable()
export class RhinestoneContractsService {
  constructor(
    private readonly publicClient: MultichainPublicClientService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  /**
   * Get the adapter address for a given selector from the router contract
   * @param chainId The chain ID where the router is deployed
   * @param router The router contract address
   * @param type Whether to get claim or fill adapter
   * @param selector The function selector to look up
   * @returns The adapter address
   */
  @Cacheable()
  async getAdapter(chainId: number, router: Address, type: 'claim' | 'fill', selector: Hex) {
    const publicClient = await this.publicClient.getClient(Number(chainId))
    const functionName = type === 'claim' ? '$claimAdapters' : 'getFillAdapter'
    return publicClient.readContract({
      abi: rhinestoneRouterAbi,
      address: router,
      functionName,
      args: [selector],
    })
  }

  /**
   * Get the claim hash oracle address from the arbiter contract
   * @param chainId The chain ID where the arbiter is deployed
   * @param arbiterAddr The arbiter contract address
   * @returns The claim hash oracle address
   */
  @Cacheable()
  async getClaimHashOracle(chainId: number, arbiterAddr: Hex) {
    const publicClient = await this.publicClient.getClient(chainId)
    return publicClient.readContract({
      abi: ecoArbiterAbi,
      address: arbiterAddr,
      functionName: 'CLAIMHASH_ORACLE',
    })
  }

  /**
   * Get the arbiter address from the adapter contract
   * @param chainID The chain ID where the adapter is deployed
   * @param adapterAddr The adapter contract address
   * @returns The arbiter address
   */
  @Cacheable()
  async getArbiter(chainID: number, adapterAddr: Hex) {
    const publicClient = await this.publicClient.getClient(chainID)
    return publicClient.readContract({
      abi: ecoAdapterAbi,
      address: adapterAddr,
      functionName: 'ARBITER',
    })
  }
}
