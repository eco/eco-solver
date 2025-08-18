import { CommandRunner } from 'nest-commander'
import { EcoConfigService } from '@eco-solver/eco-configs/eco-config.service'
import { BalanceService } from '@eco-solver/balance/balance.service'
import { KernelAccountClientService } from '@eco-solver/transaction/smart-wallets/kernel/kernel-account-client.service'

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
