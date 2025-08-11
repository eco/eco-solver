import { CommandRunner } from 'nest-commander'
import { BalanceService } from '@libs/domain'
import { KernelAccountClientService, EcoConfigService } from '@libs/integrations'

export abstract class ClientCommand extends CommandRunner {
  constructor(
    protected readonly balanceService: BalanceService,
    protected readonly kernelAccountClientService: KernelAccountClientService,
    protected readonly ecoConfigService: EcoConfigService,
  ) {
    super()
  }

  async getClient(chainID?: number) {
    return await this.kernelAccountClientService.getClient(Number(chainID || 0))
  }

  async getWalletAddress(chainID?: number) {
    const chains = this.ecoConfigService.getSupportedChains()
    const client = await this.kernelAccountClientService.getClient(Number(chains[chainID || 0]))
    return client.kernelAccount.address
  }
}
