import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { CrowdLiquidityService } from '@/intent/crowd-liquidity.service'
import { LiFiAssetCacheManager } from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Injectable } from '@nestjs/common'
import * as viemChains from 'viem/chains'

@Injectable()
export class BlockchainService {
  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly crowdLiquidityService: CrowdLiquidityService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly lifiTokenCacheManager: LiFiAssetCacheManager,
  ) {}

  async getSupportedChainsAndTokens() {
    const supportedChains = this.ecoConfigService.getSupportedChains()
    const supportedTokens = this.crowdLiquidityService.getSupportedTokens()

    const chains = await Promise.all(
      supportedChains.map(async (chain) => {
        const viemChain = Object.values(viemChains).find((c) => c.id === Number(chain))

        if (!viemChain) {
          return null
        }

        const clientKernel = await this.kernelAccountClientService.getClient(Number(chain))
        const kernelAddress = clientKernel.kernelAccount?.address

        const tokens = supportedTokens
          .filter((token) => token.chainId === Number(chain))
          .map((token) => {
            const tokenInfo = this.lifiTokenCacheManager.getTokenInfo(Number(chain), token.address)

            return {
              address: token.address,
              decimals: tokenInfo?.decimals ?? 6,
              symbol: tokenInfo?.symbol ?? 'Unknown',
            }
          })

        return {
          chainId: Number(chain),
          chainName: viemChain.name,
          chainType: 'EVM',
          wallets: [
            {
              type: 'kernel',
              address: kernelAddress,
            },
          ],
          tokens,
        }
      }),
    )

    return chains.filter((chain) => chain)
  }
}
