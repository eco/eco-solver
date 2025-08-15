import { Injectable, Logger } from '@nestjs/common'
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import { Hex, isAddressEqual } from 'viem'
import { Network } from '@/common/alchemy/network'
import { entries, keyBy } from 'lodash'
import { Solver } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { recursiveConfigDenormalizer } from '@/eco-configs/utils'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { serialize } from '@/common/utils/serialize'
import { deconvertNormScalar } from '@/fee/utils'
import { CONFIG_DECIMALS } from '@/intent/utils'
import { BalanceService } from '@/balance/balance.service'
import { TokenBalance } from '@/balance/types'

type TokenType = {
  token: Hex
  decimal: string
  value: string
  minBalances?: string
  isHealthy: boolean
}

@Injectable()
export class BalanceHealthIndicator extends HealthIndicator {
  private logger = new Logger(BalanceHealthIndicator.name)

  constructor(
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly configService: EcoConfigService,
    private readonly balanceService: BalanceService,
  ) {
    super()
  }

  async checkBalances(): Promise<HealthIndicatorResult> {
    const minEthBalanceWei = this.configService.getEth().simpleAccount.minEthBalanceWei
    const [accounts, solvers, sources] = await Promise.all([
      this.getAccount(),
      this.getSolvers(),
      this.getSources(),
    ])

    const areNativeTokensHealthy = accounts.every((bal) => BigInt(bal.balance) >= minEthBalanceWei)

    const areTokensHealthy = solvers.balances
      .flatMap((balance) => Object.values(balance.tokens))
      .every((token) => token.isHealthy)

    const isHealthy = areNativeTokensHealthy && areTokensHealthy

    const results = this.getStatus('balances', isHealthy, {
      totalTokenBalance: solvers.totalTokenBalance,
      accounts,
      solvers: solvers.balances,
      sources,
    })

    if (isHealthy) {
      return serialize(results)
    }
    throw new HealthCheckError('Balances failed', serialize(results))
  }

  private async getAccount(): Promise<any[]> {
    const minEthBalanceWei = this.configService.getEth().simpleAccount.minEthBalanceWei
    const accountBalance: {
      kernelAddress: `0x${string}`
      eocAddress: `0x${string}`
      chainID: number
      balance: string
      minEthBalanceWei: string
    }[] = []
    const solvers = this.configService.getSolvers()
    const balanceTasks = entries(solvers).map(async ([, solver]) => {
      const clientKernel = await this.kernelAccountClientService.getClient(solver.chainID)
      const kernelAddress = clientKernel.kernelAccount?.address
      const eocAddress = clientKernel.account?.address

      if (eocAddress && kernelAddress) {
        const bal = await clientKernel.getBalance({ address: eocAddress })
        accountBalance.push({
          kernelAddress,
          eocAddress,
          chainID: solver.chainID,
          balance: '        ' + BigInt(bal).toString(), //makes comparing easier in json
          minEthBalanceWei: minEthBalanceWei.toString(),
        })
      }
    })
    await Promise.all(balanceTasks)

    return accountBalance.reverse()
  }

  private async getSources(): Promise<any[]> {
    const sources: Array<{
      accountAddress: `0x${string}` | undefined
      tokens: Record<string, TokenType>
      network: Network
      chainID: number
      sourceAddress: Hex
      provers: Hex[]
    }> = []
    const IntentSources = this.configService.getIntentSources()
    for (const IntentSource of IntentSources) {
      const client = await this.kernelAccountClientService.getClient(IntentSource.chainID)
      const accountAddress = client.kernelAccountAddress

      const balances = await this.balanceService.fetchTokenBalances(
        IntentSource.chainID,
        IntentSource.tokens,
      )
      const denormalizedBalances = Object.values(balances).map((token) => ({
        ...token,
        balance: deconvertNormScalar(token.balance, token.decimals.original),
      }))
      const sourceBalances = this.joinBalance(denormalizedBalances)

      sources.push({ ...IntentSource, accountAddress, tokens: sourceBalances })
    }
    sources.reverse()
    return sources
  }

  private async getSolvers(): Promise<{
    balances: { tokens: Record<string, TokenType> }[]
    totalTokenBalance: string
  }> {
    const solverBalances: Array<{
      accountAddress: `0x${string}` | undefined
      tokens: Record<string, TokenType>
      inboxAddress: Hex
      network: Network
      chainID: number
    }> = []
    let totalTokenBalance = 0n
    const solverConfig = recursiveConfigDenormalizer(this.configService.getSolvers())
    await Promise.all(
      Object.entries(solverConfig).map(async ([, solver]) => {
        const client = await this.kernelAccountClientService.getClient(solver.chainID)
        const accountAddress = client.kernelAccountAddress
        const tokens = Object.keys(solver.targets) as Hex[]

        const balances = await this.balanceService.fetchTokenBalances(solver.chainID, tokens)
        const denormalizedBalances = Object.values(balances).map((token) => ({
          ...token,
          balance: deconvertNormScalar(token.balance, CONFIG_DECIMALS),
        }))
        const solverBalanceString = this.joinBalance(denormalizedBalances, solver.targets)

        entries(solver.targets).forEach((target) => {
          const targetConfig = target[1] as any
          targetConfig.balance = solverBalanceString[target[0]]
          totalTokenBalance += BigInt(solverBalanceString[target[0]].value)
        })

        solverBalances.push({
          ...solver,
          accountAddress,
          tokens: solverBalanceString,
        })
      }),
    )
    return { balances: solverBalances, totalTokenBalance: totalTokenBalance.toString() }
  }

  private joinBalance(tokens: TokenBalance[], targets?: Solver['targets']) {
    const tokenTypes = tokens.map((token): TokenType => {
      // Find Target by token address
      const solverToken = Object.entries(targets ?? []).find(([tokenAddr]) =>
        isAddressEqual(tokenAddr as Hex, token.address),
      )?.[1]

      const minBalance = solverToken && BigInt(solverToken.minBalance)
      const isHealthy = this.isTokenHealthy(token, minBalance)

      return {
        isHealthy,
        token: token.address,
        value: token.balance.toString(),
        decimal: token.decimals.current.toString(),
        minBalances: minBalance?.toString(),
      }
    })

    return keyBy(tokenTypes, 'token')
  }

  private isTokenHealthy(token: TokenBalance, minimumBalance?: bigint) {
    if (!minimumBalance) {
      // Returns true if minimum balance is not defined
      return true
    }

    return token.balance >= minimumBalance
  }
}
