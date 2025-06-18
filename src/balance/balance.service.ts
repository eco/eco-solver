import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
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
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cacheable } from '@/decorators/cacheable.decorator'

/**
 * Composite data from fetching the token balances for a chain
 */
export type TokenFetchAnalysis = {
  config: TokenConfig
  token: TokenBalance
  chainId: number
}

/**
 * Service class for getting configs for the app
 */
@Injectable()
export class BalanceService implements OnApplicationBootstrap {
  private logger = new Logger(BalanceService.name)

  private readonly tokenBalances: Map<string, TokenBalance> = new Map()

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
  ) {}

  async onApplicationBootstrap() {
    // iterate over all tokens
    await Promise.all(this.getInboxTokens().map((token) => this.loadTokenBalance(token)))
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

  /**
   * Gets the tokens that are in the solver wallets
   * @returns List of tokens that are supported by the solver
   */
  getInboxTokens(): TokenConfig[] {
    return Object.values(this.configService.getSolvers()).flatMap((solver) => {
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

  /**
   * Fetches the balances of the kernel account client of the solver for the given tokens
   * @param chainID the chain id
   * @param tokenAddresses the tokens to fetch balances for
   * @returns
   */
  @Cacheable({ bypassArgIndex: 2 })
  async fetchTokenBalances(
    chainID: number,
    tokenAddresses: Hex[],
    //used by cacheable decorator
    forceRefresh = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Record<Hex, TokenBalance>> {
    const client = await this.kernelAccountClientService.getClient(chainID)
    const walletAddress = client.kernelAccount.address
    return this.fetchWalletTokenBalances(chainID, walletAddress, tokenAddresses)
  }

  /**
   * Fetches the native token balance (ETH, MATIC, etc.) for the solver's EOA account on the specified chain.
   *
   * This method retrieves the native gas token balance for the externally owned account (EOA)
   * associated with the kernel account client. The balance is cached to improve performance.
   *
   * @param chainID - The chain ID to fetch the native balance from
   * @returns Promise<bigint> - The native token balance in wei (smallest unit), or 0n if accounts are not available
   *
   * @example
   * ```typescript
   * // Get ETH balance on Ethereum mainnet (chain ID 1)
   * const ethBalance = await balanceService.fetchNativeBalance(1);
   * console.log(`ETH Balance: ${ethBalance.toString()} wei`);
   *
   * // Get MATIC balance on Polygon (chain ID 137)
   * const maticBalance = await balanceService.fetchNativeBalance(137);
   * ```
   *
   * @throws Will throw an error if the kernel account client cannot be retrieved for the given chain
   */
  @Cacheable({ bypassArgIndex: 1 })
  async fetchNativeBalance(
    chainID: number,
    //used by cacheable decorator
    forceRefresh = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<{ balance: bigint; blockNumber: bigint }> {
    const clientKernel = await this.kernelAccountClientService.getClient(chainID)
    const kernelAddress = clientKernel.kernelAccount?.address
    const eocAddress = clientKernel.account?.address
    const results = await Promise.all([
      (async () => {
        if (eocAddress && kernelAddress) {
          const balance = await clientKernel.getBalance({ address: eocAddress })
          return balance
        }
        return 0n
      })(),
      clientKernel.getBlockNumber(),
    ])

    return { balance: results[0], blockNumber: results[1] }
  }

  /**
   * Fetches native balances for all solver chains in parallel
   * Used by balance tracker service for initialization
   */
  @Cacheable({ bypassArgIndex: 0 })
  async fetchAllNativeBalances(
    forceRefresh = false,
  ): Promise<Array<{ chainId: number; balance: bigint; blockNumber: bigint } | null>> {
    // Get native balances for all chains
    const chainIds = Object.keys(this.configService.getSolvers()).map(Number)
    const nativeBalancePromises = chainIds.map(async (chainId) => {
      try {
        const nativeBalanceData = await this.fetchNativeBalance(chainId, forceRefresh)
        return {
          chainId,
          balance: nativeBalanceData.balance,
          blockNumber: nativeBalanceData.blockNumber,
        }
      } catch (error) {
        return null
      }
    })

    return Promise.all(nativeBalancePromises)
  }

  /**
   * Fetches the token balances of a wallet for the given token list.
   * @param chainID the chain id
   * @param walletAddress wallet address
   * @param tokenAddresses the tokens to fetch balances for
   * @returns
   */
  async fetchWalletTokenBalances(
    chainID: number,
    walletAddress: string,
    tokenAddresses: Hex[],
  ): Promise<Record<Hex, TokenBalance>> {
    const client = await this.kernelAccountClientService.getClient(chainID)

    this.logger.debug(
      EcoLogMessage.fromDefault({
        message: `fetchWalletTokenBalances`,
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

    const tokenBalances: Record<Hex, TokenBalance> = {}

    tokenAddresses.forEach((tokenAddress, index) => {
      const [balance = 0n, decimals = 0] = [results[index * 2], results[index * 2 + 1]]
      //throw if we suddenly start supporting tokens with not 6 decimals
      //audit conversion of validity to see its support
      if ((decimals as number) != 6) {
        throw EcoError.BalanceServiceInvalidDecimals(tokenAddress)
      }
      tokenBalances[tokenAddress] = {
        address: tokenAddress,
        balance: balance as bigint,
        decimals: decimals as number,
      }
    })
    return tokenBalances
  }

  @Cacheable()
  async fetchTokenBalance(chainID: number, tokenAddress: Hex): Promise<TokenBalance> {
    const result = await this.fetchTokenBalances(chainID, [tokenAddress])
    return result[tokenAddress]
  }

  @Cacheable()
  async fetchTokenBalancesForChain(
    chainID: number,
  ): Promise<Record<Hex, TokenBalance> | undefined> {
    const intentSource = this.configService.getIntentSource(chainID)
    if (!intentSource) {
      return undefined
    }
    return this.fetchTokenBalances(chainID, intentSource.tokens)
  }

  @Cacheable()
  async fetchTokenData(chainID: number): Promise<TokenFetchAnalysis[]> {
    const tokenConfigs = groupBy(this.getInboxTokens(), 'chainId')[chainID]
    const tokenAddresses = tokenConfigs.map((token) => token.address)
    const tokenBalances = await this.fetchTokenBalances(chainID, tokenAddresses)
    return zipWith(tokenConfigs, Object.values(tokenBalances), (config, token) => ({
      config,
      token,
      chainId: chainID,
    }))
  }

  @Cacheable({ bypassArgIndex: 0 })
  async getAllTokenData(forceRefresh = false) {
    const tokens = this.getInboxTokens()
    const tokensByChainId = groupBy(tokens, 'chainId')
    const chainIds = Object.keys(tokensByChainId)

    const balancesPerChainIdPromise = chainIds.map(async (chainId) => {
      const configs = tokensByChainId[chainId]
      const tokenAddresses = configs.map((token) => token.address)
      const balances = await this.fetchTokenBalances(
        parseInt(chainId),
        tokenAddresses,
        forceRefresh,
      )
      return zipWith(configs, Object.values(balances), (config, balance) => ({
        config,
        balance,
        chainId: parseInt(chainId),
      }))
    })

    return Promise.all(balancesPerChainIdPromise).then((result) => result.flat())
  }

  async getAllTokenDataForAddress(walletAddress: string, tokens: TokenConfig[]) {
    const tokensByChainId = groupBy(tokens, 'chainId')
    const chainIds = Object.keys(tokensByChainId)

    const balancesPerChainIdPromise = chainIds.map(async (chainId) => {
      const configs = tokensByChainId[chainId]
      const tokenAddresses = configs.map((token) => token.address)
      const balances = await this.fetchWalletTokenBalances(
        parseInt(chainId),
        walletAddress,
        tokenAddresses,
      )
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
