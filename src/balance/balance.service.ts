import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy, zipWith } from 'lodash'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { getDestinationNetworkAddressKey } from '@/common/utils/strings'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { erc20Abi, Hex, MulticallParameters, MulticallReturnType } from 'viem'
import { ViemEventLog } from '@/common/events/viem'
import { decodeTransferLog, isSupportedTokenType } from '@/contracts'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { TokenBalance, TokenConfig } from '@/balance/types'
import { EcoError } from '@/common/errors/eco-error'

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class BalanceService implements OnApplicationBootstrap {
  private logger = new Logger(BalanceService.name)

  private readonly tokenBalances: Map<string, TokenBalance> = new Map()

  constructor(
    private readonly ecoConfig: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {}

  async onApplicationBootstrap() {
    // iterate over all tokens
    await Promise.all(this.getTokens().map((token) => this.loadTokenBalance(token)))
  }

  /**
   * Get the token balance of the solver
   * @returns
   */
  async getTokenBalance(chainID: number, tokenAddress: Hex) {
    return (
      this.tokenBalances.get(getDestinationNetworkAddressKey(chainID, tokenAddress)) ?? {
        balance: 0n,
        decimals: 0n,
      }
    )
  }

  /**
   * Updates the token balance of the solver, called from {@link EthWebsocketProcessor}
   * @returns
   */
  updateBalance(balanceEvent: ViemEventLog) {
    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `updateBalance ${balanceEvent.transactionHash}`,
        properties: {
          intentHash: balanceEvent.transactionHash,
        },
      }),
    )

    const intent = decodeTransferLog(balanceEvent.data, balanceEvent.topics)
    const key = getDestinationNetworkAddressKey(balanceEvent.sourceChainID, balanceEvent.address)
    const balanceObj = this.tokenBalances.get(key)
    if (balanceObj) {
      balanceObj.balance = balanceObj.balance + intent.args.value
    }
  }

  getTokens(): TokenConfig[] {
    return Object.values(this.ecoConfig.getSolvers()).flatMap((solver) => {
      return Object.entries(solver.targets)
        .filter(([, targetContract]) => isSupportedTokenType(targetContract.contractType))
        .map(([tokenAddress, targetContract]) => ({
          address: tokenAddress as Hex,
          chainId: solver.chainID,
          type: targetContract.contractType,
          minBalance: targetContract.minBalance,
          targetBalance: targetContract.targetBalance,
        }))
    })
  }

  async fetchTokenBalances(
    chainID: number,
    tokenAddresses: Hex[],
  ): Promise<Record<Hex, TokenBalance>> {
    const client = await this.kernelAccountClientService.getClient(chainID)
    const walletAddress = client.kernelAccount.address

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `fetchTokenBalances`,
        properties: {
          chainID,
          tokenAddresses,
          walletAddress,
        },
      }),
    )

    const results = (await client.multicall({
      contracts: tokenAddresses.flatMap((tokenAddress): MulticallParameters['contracts'] => [
        {
          abi: erc20Abi,
          address: tokenAddress,
          functionName: 'balanceOf',
          args: [walletAddress],
        },
        {
          abi: erc20Abi,
          address: tokenAddress,
          functionName: 'decimals',
        },
      ]),
      allowFailure: false,
    })) as MulticallReturnType

    const result: Record<Hex, TokenBalance> = {}

    tokenAddresses.forEach((tokenAddress, index) => {
      const [balance = 0n, decimals = 0] = [results[index * 2], results[index * 2 + 1]]
      result[tokenAddress] = {
        address: tokenAddress,
        balance: balance as bigint,
        decimals: decimals as number,
      }
    })

    return result
  }

  async fetchTokenBalance(chainID: number, tokenAddress: Hex): Promise<TokenBalance> {
    const result = await this.fetchTokenBalances(chainID, [tokenAddress])
    return result[tokenAddress]
  }

  async getAllTokenData() {
    const tokens = this.getTokens()
    const tokensByChainId = groupBy(tokens, 'chainId')
    const chainIds = Object.keys(tokensByChainId)

    const balancesPerChainIdPromise = chainIds.map(async (chainId) => {
      const configs = tokensByChainId[chainId]
      const tokenAddresses = configs.map((token) => token.address)
      const balances = await this.fetchTokenBalances(parseInt(chainId), tokenAddresses)
      return zipWith(configs, Object.values(balances), (config, balance) => ({
        config,
        balance,
        chainId: parseInt(chainId),
      }))
    })

    return Promise.all(balancesPerChainIdPromise).then((result) => result.flat())
  }

  /**
   * Loads the token balance of the solver
   * @returns
   */
  private async loadTokenBalance(token: TokenConfig) {
    switch (token.type) {
      case 'erc20':
        return this.loadERC20TokenBalance(token.chainId, token.address)
      default:
        throw EcoError.IntentSourceUnsupportedTargetType(token.type)
    }
  }

  private async loadERC20TokenBalance(
    chainID: number,
    tokenAddress: Hex,
  ): Promise<TokenBalance | undefined> {
    const key = getDestinationNetworkAddressKey(chainID, tokenAddress)
    if (!this.tokenBalances.has(key)) {
      const tokenBalance = await this.fetchTokenBalance(chainID, tokenAddress)
      this.tokenBalances.set(key, tokenBalance)
    }
    return this.tokenBalances.get(key)
  }
}
