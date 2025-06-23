import { CommandRunner } from 'nest-commander'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { RpcBalanceService } from '@/balance/services/rpc-balance.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'

export abstract class ClientCommand extends CommandRunner {
  constructor(
    protected readonly balanceService: RpcBalanceService,
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
