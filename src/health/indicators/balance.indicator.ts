import { Injectable, Logger } from '@nestjs/common'
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus'
import { EcoConfigService } from '../../eco-configs/eco-config.service'
import { erc20Abi, Hex } from 'viem'
import { Network } from 'alchemy-sdk'
import { entries } from 'lodash'
import { TargetContract } from '../../eco-configs/eco-config.types'
import { KernelAccountClientService } from '../../transaction/smart-wallets/kernel/kernel-account-client.service'

type TokenType = { decimal: string; value: string; minBalances?: number }
@Injectable()
export class BalanceHealthIndicator extends HealthIndicator {
  private logger = new Logger(BalanceHealthIndicator.name)
  constructor(
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly configService: EcoConfigService,
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
    let isHealthy = solvers.every((solver) => {
      const tokens = solver.tokens
      return Object.values(tokens).every((token) => {
        if (!token.minBalances) {
          return true
        }
        const minBalanceDecimal = BigInt(token.minBalances) * BigInt(token.decimal) * 10n
        return BigInt(token.value) >= minBalanceDecimal
      })
    })

    isHealthy =
      isHealthy &&
      accounts.every((bal) => {
        return BigInt(bal.balance) > minEthBalanceWei
      })
    const results = this.getStatus('balances', isHealthy, { accounts, solvers, sources })
    if (isHealthy) {
      return results
    }
    throw new HealthCheckError('Balances failed', results)
  }

  private async getAccount(): Promise<any[]> {
    const minEthBalanceWei = this.configService.getEth().simpleAccount.minEthBalanceWei
    const accountBalance: {
      address: `0x${string}`
      chainID: number
      balance: string
      minEthBalanceWei: number
    }[] = []
    const solvers = this.configService.getSolvers()
    const balanceTasks = entries(solvers).map(async ([, solver]) => {
      const clientKernel = await this.kernelAccountClientService.getClient(solver.chainID)
      const address = clientKernel.kernelAccount?.address

      if (address) {
        const bal = await clientKernel.getBalance({ address })
        accountBalance.push({
          address,
          chainID: solver.chainID,
          balance: BigInt(bal).toString(),
          minEthBalanceWei,
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

      const balances = await this.getBalanceCalls(IntentSource.chainID, IntentSource.tokens)

      const sourceBalancesString = this.joinBalance(balances, IntentSource.tokens)
      sources.push({ ...IntentSource, accountAddress, tokens: sourceBalancesString })
    }
    sources.reverse()
    return sources
  }

  private async getSolvers(): Promise<{ tokens: Record<string, TokenType> }[]> {
    const solvers: Array<{
      accountAddress: `0x${string}` | undefined
      tokens: Record<string, TokenType>
      inboxAddress: Hex
      network: Network
      chainID: number
    }> = []

    const solverConfig = this.configService.getSolvers()
    await Promise.all(
      Object.entries(solverConfig).map(async ([, solver]) => {
        const client = await this.kernelAccountClientService.getClient(solver.chainID)
        const accountAddress = client.kernelAccountAddress
        const tokens = Object.keys(solver.targets) as Hex[]
        const balances = await this.getBalanceCalls(solver.chainID, tokens)
        const mins = Object.values(solver.targets).map((target) => target.minBalance)
        const sourceBalancesString = this.joinBalance(balances, tokens, mins)
        entries(solver.targets).forEach((target) => {
          ;(target[1] as TargetContract & { balance: object }).balance =
            sourceBalancesString[target[0]]
        })

        solvers.push({
          ...solver,
          accountAddress,
          tokens: sourceBalancesString,
        })
      }),
    )
    return solvers
  }

  private async getBalanceCalls(chainID: number, tokens: Hex[]) {
    const client = await this.kernelAccountClientService.getClient(chainID)
    const accountAddress = client.kernelAccountAddress

    const balanceCalls = tokens.map((token) => {
      return [
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
      ]
    })

    return await client.multicall({
      contracts: balanceCalls.flat(),
    })
  }

  private joinBalance(
    balances: any,
    tokens: string[],
    minBalances: number[] = [],
  ): Record<string, TokenType> {
    let decimal = 0n,
      value = 0n,
      i = 0
    const sourceBalancesString: Record<string, TokenType> = {}

    while (
      balances.length > 0 &&
      ([{ result: value as unknown }, { result: decimal as unknown }] = [
        balances.shift(),
        balances.shift(),
      ])
    ) {
      sourceBalancesString[tokens[i]] = {
        decimal: BigInt(decimal).toString(),
        value: BigInt(value).toString(),
        ...(minBalances ? { minBalances: minBalances[i] } : {}),
      }
      i++
    }
    return sourceBalancesString
  }
}
