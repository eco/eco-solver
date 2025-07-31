import { Inject, Injectable } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { Address, Hex } from 'viem'
import { MultichainPublicClientService } from '@/transaction/multichain-public-client.service'
import { ecoArbiterAbi } from '@/contracts/rhinestone/EcoArbiter'
import { ecoAdapterAbi } from '@/contracts/rhinestone/EcoAdapter'
import { rhinestoneRouterAbi } from '@/contracts/rhinestone/RhinestoneRouter'
import { Cacheable } from '@/decorators/cacheable.decorator'

@Injectable()
export class RhinestoneContractsService {
  constructor(
    private readonly publicClient: MultichainPublicClientService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

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

  @Cacheable()
  async getClaimHashOracle(chainId: number, arbiterAddr: Hex) {
    const publicClient = await this.publicClient.getClient(chainId)
    return publicClient.readContract({
      abi: ecoArbiterAbi,
      address: arbiterAddr,
      functionName: 'CLAIMHASH_ORACLE',
    })
  }

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
