import { getAddress } from 'viem'
import { Command, Option } from 'nest-commander'
import { EcoConfigService } from '@libs/solver-config'
import { BalanceService } from '../../balance/balance.service'
import { KernelAccountClientService } from '../../transaction/smart-wallets/kernel/kernel-account-client.service'
import { jsonBigInt } from '../utils'
import { ClientCommand } from '../transfer/client.command'

@Command({
  name: 'balance',
  description: 'Displays the balance of the Kernel wallet',
})
export class BalanceCommand extends ClientCommand {
  constructor(
    protected readonly balanceService: BalanceService,
    protected readonly kernelAccountClientService: KernelAccountClientService,
    protected readonly ecoConfigService: EcoConfigService,
  ) {
    super(balanceService, kernelAccountClientService, ecoConfigService)
  }

  async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
    console.log(`Wallet address: ${await this.getWalletAddress()}`)
    if (Object.values(options || {}).length === 0) {
      console.log('No options provided, fetching all token data')
      const data = await this.balanceService.getAllTokenData()
      console.log(`Token data:`)
      console.log(jsonBigInt(data))
      return
    }

    if (options?.chainID && options?.token) {
      console.log(`Fetching balance on ${options.chainID} for ${options.token}`)
      const data = await this.balanceService.fetchTokenBalances(options.chainID, [options.token])

      console.log(`Token data on chain : ${options.chainID}:`)
      console.log(jsonBigInt(data))
      return
    }

    if (options?.chainID) {
      console.log(`Fetching all balances on ${options.chainID}`)
      const data = await this.balanceService.fetchTokenBalancesForChain(options.chainID)
      console.log(`Tokens data on chain : ${options.chainID}:`)
      console.log(jsonBigInt(data))
    }

    console.log(`You must set the chainID and token to get the balance of a token`)
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
