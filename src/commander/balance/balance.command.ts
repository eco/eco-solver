import { getAddress } from 'viem'
import { Command, CommandRunner, Option } from 'nest-commander'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { BalanceService } from '@/balance/balance.service'

@Command({
  name: 'balance',
  description: 'Displays the balance of the Kernel wallet',
})
export class BalanceCommand extends CommandRunner {
  constructor(
    private readonly balanceService: BalanceService,
    private readonly ecoConfigService: EcoConfigService,
  ) {
    super()
  }

  async run(passedParams: string[], options?: Record<string, any>): Promise<void> {
    if (Object.values(options || {}).length === 0) {
      console.log('No options provided, fetching all token data')
      const data = await this.balanceService.getAllTokenData()
      console.log(`Token data:`)
      console.log(json(data))
      return
    }

    if (options?.chainID && options?.token) {
      console.log(`Fetching balance on ${options.chainID} for ${options.token}`)
      const data = await this.balanceService.fetchTokenBalances(options.chainID, [options.token])

      console.log(`Token data on chain : ${options.chainID}:`)
      console.log(json(data))
      return
    }

    if (options?.chainID) {
      console.log(`Fetching all balances on ${options.chainID}`)
      const data = await this.balanceService.fetchTokenBalancesForChain(options.chainID)
      console.log(`Tokens data on chain : ${options.chainID}:`)
      console.log(json(data))
    }

    console.log(`You must set the chainID and token to get the balance of a token`)
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

function json(data: any) {
  return JSON.stringify(data, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
}
