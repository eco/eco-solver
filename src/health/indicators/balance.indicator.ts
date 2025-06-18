import { Injectable, Logger } from '@nestjs/common'
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import { erc20Abi, Hex, isAddressEqual } from 'viem'
import { Network } from '@/common/alchemy/network'
import { entries, keyBy } from 'lodash'
import { Solver } from '@/eco-configs/eco-config.types'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { BalanceService } from '@/balance/balance.service'

type TokenType = {
  token: Hex
  decimal: string
  value: string
  minBalances?: string
  isHealthy: boolean
}
type TokenData = { token: Hex; chainID: number; balance: bigint; decimal: bigint }

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
      totalBalance: solvers.totalTokenBalance,
      accounts,
      solvers: solvers.balances,
      sources,
    })

    if (isHealthy) {
      return results
    }
    throw new HealthCheckError('Balances failed', results)
  }

  private async getAccount(): Promise<any[]> {
    const minEthBalanceWei = this.configService.getEth().simpleAccount.minEthBalanceWei
    const accountBalance: {
      kernelAddress: `0x${string}`
      eocAddress: `0x${string}`
      chainID: number
      balance: string
      minEthBalanceWei: number
    }[] = []
    const solvers = this.configService.getSolvers()

    // Get all native balances using the balance service
    const nativeBalances = await this.balanceService.fetchAllNativeBalances()
    const nativeBalancesByChain = keyBy(nativeBalances.filter(Boolean), 'chainId')

    const balanceTasks = entries(solvers).map(async ([, solver]) => {
      const clientKernel = await this.kernelAccountClientService.getClient(solver.chainID)
      const kernelAddress = clientKernel.kernelAccount?.address
      const eocAddress = clientKernel.account?.address

      if (eocAddress && kernelAddress) {
        // Use balance from the balance service instead of direct client call
        const nativeBalance = nativeBalancesByChain[solver.chainID]
        const bal = nativeBalance ? nativeBalance.balance : 0n

        accountBalance.push({
          kernelAddress,
          eocAddress,
          chainID: solver.chainID,
          balance: '        ' + BigInt(bal).toString(), //makes comparing easier in json
          minEthBalanceWei,
        })
      }
    })
    await Promise.all(balanceTasks)

    return accountBalance.sort((a, b) => a.chainID - b.chainID)
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

      const balances = await this.getBalanceCalls(IntentSource.chainID, IntentSource.tokens)
      const sourceBalances = this.joinBalance(balances)

      sources.push({ ...IntentSource, accountAddress, tokens: sourceBalances })
    }
    sources.reverse()
    return sources
  }

  private async getSolvers(): Promise<{
    balances: { tokens: Record<string, TokenType> }[]
    totalTokenBalance: number
  }> {
    const solverBalances: Array<{
      accountAddress: `0x${string}` | undefined
      tokens: Record<string, TokenType>
      inboxAddress: Hex
      network: Network
      chainID: number
    }> = []
    let totalTokenBalance = 0
    const solverConfig = this.configService.getSolvers()
    await Promise.all(
      Object.entries(solverConfig).map(async ([, solver]) => {
        const client = await this.kernelAccountClientService.getClient(solver.chainID)
        const accountAddress = client.kernelAccountAddress
        const tokens = Object.keys(solver.targets) as Hex[]

        const balances = await this.getBalanceCalls(solver.chainID, tokens)
        const sourceBalancesString = this.joinBalance(balances, solver.targets)

        entries(solver.targets).forEach((target) => {
          ;(target[1] as any).balance = sourceBalancesString[target[0]]
          totalTokenBalance += parseInt(sourceBalancesString[target[0]].value)
        })

        solverBalances.push({
          ...solver,
          accountAddress,
          tokens: sourceBalancesString,
        })
      }),
    )
    return { balances: solverBalances, totalTokenBalance }
  }

  private async getBalanceCalls(chainID: number, tokens: Hex[]): Promise<TokenData[]> {
    const client = await this.kernelAccountClientService.getClient(chainID)
    const accountAddress = client.kernelAccountAddress

    const balanceCalls = tokens.flatMap((token) => [
      {
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [accountAddress],
      },
      {
        address: token,
        abi: erc20Abi,
        functionName: 'decimals',
      },
    ])

    const results = await client.multicall({ contracts: balanceCalls })

    return tokens.map((token, tokenIndex) => {
      const index = tokenIndex * 2
      const [balance, decimal] = [results[index], results[index + 1]]
      return { chainID, token, balance: BigInt(balance.result!), decimal: BigInt(decimal.result!) }
    })
  }

  private joinBalance(tokens: TokenData[], targets?: Solver['targets']) {
    const tokenTypes = tokens.map((token): TokenType => {
      // Find Target by token address
      const solverToken = Object.entries(targets ?? []).find(([tokenAddr]) =>
        isAddressEqual(tokenAddr as Hex, token.token),
      )?.[1]

      const minBalance = solverToken && BigInt(solverToken.minBalance)
      const isHealthy = this.isTokenHealthy(token, minBalance)

      return {
        isHealthy,
        token: token.token,
        value: token.balance.toString(),
        decimal: token.decimal.toString(),
        minBalances: minBalance?.toString(),
      }
    })

    return keyBy(tokenTypes, 'token')
  }

  private isTokenHealthy(token: TokenData, minimumBalance?: bigint) {
    if (!minimumBalance) {
      // Returns true if minimum balance is not defined
      return true
    }

    return token.balance >= minimumBalance
  }
}
