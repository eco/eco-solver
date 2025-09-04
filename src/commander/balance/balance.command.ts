import { getAddress } from 'viem'
import { Command, Option } from 'nest-commander'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'
import { GenericOperationLogger } from '@/common/logging/loggers'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { jsonBigInt } from '@/commander/utils'
import { ClientCommand } from '@/commander/transfer/client.command'

@Command({
  name: 'balance',
  description: 'Displays the balance of the Kernel wallet',
})
export class BalanceCommand extends ClientCommand {
  private logger = new GenericOperationLogger('BalanceCommand')

  constructor(
    protected readonly balanceService: BalanceService,
    protected readonly kernelAccountClientService: KernelAccountClientService,
    protected readonly ecoConfigService: EcoConfigService,
  ) {
    super(balanceService, kernelAccountClientService, ecoConfigService)
  }

  async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
    const walletAddress = await this.getWalletAddress()
    this.logger.info({ message: 'Balance command executed', wallet_address: walletAddress })

    if (Object.values(options || {}).length === 0) {
      const data = await this.balanceService.getAllTokenData()
      this.logger.info({
        message: 'Fetched all token data',
        token_count: Object.keys(data).length,
        data: jsonBigInt(data),
      })
      return
    }

    if (options?.chainID && options?.token) {
      const data = await this.balanceService.fetchTokenBalances(options.chainID, [options.token])
      this.logger.info({
        message: 'Fetched token balance',
        chain_id: options.chainID,
        token: options.token,
        data: jsonBigInt(data),
      })
      return
    }

    if (options?.chainID) {
      const data = await this.balanceService.fetchTokenBalancesForChain(options.chainID)
      this.logger.info({
        message: 'Fetched chain balances',
        chain_id: options.chainID,
        token_count: Object.keys(data || {}).length,
        data: jsonBigInt(data),
      })
      return
    }

    this.logger.warn(
      { operationType: 'balance_check', status: 'error' },
      'Invalid parameters: chainID and token required',
    )
  }

  async getWalletAddress() {
    const chains = this.ecoConfigService.getSupportedChains()
    const client = await this.kernelAccountClientService.getClient(Number(chains[0]))
    return client.kernelAccount.address
  }

  // 84532 0xAb1D243b07e99C91dE9E4B80DFc2B07a8332A2f7
  @Option({
    flags: '-c, --chainID <chainID>',
    description: 'The chain ID for a token balance',
  })
  parseChainID(val: string) {
    return Number(val)
  }

  @Option({
    flags: '-t, --token <token>',
    description: 'The token address to get the balance of',
  })
  parseToken(val: string) {
    return getAddress(val)
  }
}
