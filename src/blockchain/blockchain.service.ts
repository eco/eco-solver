import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { LiFiAssetCacheManager } from '@/liquidity-manager/services/liquidity-providers/LiFi/utils/token-cache-manager'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { Injectable, Logger } from '@nestjs/common'
import * as viemChains from 'viem/chains'
import { ChainsResponse } from './types'
import { BalanceService } from '@/balance/balance.service'

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name)
  private readonly lifiTokenCacheManager: LiFiAssetCacheManager

  constructor(
    private readonly ecoConfigService: EcoConfigService,
    private readonly balanceService: BalanceService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {
    // Initialize the asset cache manager
    this.lifiTokenCacheManager = new LiFiAssetCacheManager(this.ecoConfigService, this.logger)
  }

  async getSupportedChainsAndTokens() {
    const supportedChains = this.ecoConfigService.getSupportedChains()
    const supportedTokens = this.balanceService.getInboxTokens()

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

    return chains.filter((chain) => chain) as ChainsResponse
  }
}
