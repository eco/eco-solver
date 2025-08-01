import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { groupBy, zipWith } from 'lodash'
import { EcoConfigService } from '@/eco-configs/eco-config.service'
import { getDestinationNetworkAddressKey } from '@/common/utils/strings'
import { EcoLogMessage } from '@/common/logging/eco-log-message'
import { erc20Abi, Hex, MulticallParameters, MulticallReturnType } from 'viem'
import { ViemEventLog } from '@/common/events/viem'
import { decodeTransferLog } from '@/contracts'
import { KernelAccountClientService } from '@/transaction/smart-wallets/kernel/kernel-account-client.service'
import { TokenBalance, TokenConfig } from '@/balance/types/balance.types'
import { EcoError } from '@/common/errors/eco-error'
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cacheable } from '@/decorators/cacheable.decorator'
import { EcoAnalyticsService } from '@/analytics'
import { ANALYTICS_EVENTS } from '@/analytics/events.constants'

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
export class RpcBalanceService implements OnApplicationBootstrap {
  private logger = new Logger(RpcBalanceService.name)

  private readonly tokenBalances: Map<string, TokenBalance> = new Map()

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: EcoConfigService,
    private readonly kernelAccountClientService: KernelAccountClientService,
    private readonly ecoAnalytics: EcoAnalyticsService,
  ) {}

  async onApplicationBootstrap() {
    // iterate over all tokens
    await Promise.all(
      this.configService.getInboxTokens().map((token) => this.loadTokenBalance(token)),
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
    const startTime = Date.now()

    try {
      const client = await this.kernelAccountClientService.getClient(chainID)
      const walletAddress = client.kernelAccount.address
      const result = await this.fetchWalletTokenBalances(chainID, walletAddress, tokenAddresses)

      // Track successful balance fetch
      this.ecoAnalytics.trackSuccess(ANALYTICS_EVENTS.BALANCE.FETCH_SUCCESS, {
        chainID,
        walletAddress,
        tokenCount: tokenAddresses.length,
        processingTimeMs: Date.now() - startTime,
      })

      return result
    } catch (error) {
      // Track balance fetch error
      this.ecoAnalytics.trackError(ANALYTICS_EVENTS.BALANCE.FETCH_FAILED, error, {
        chainID,
        tokenCount: tokenAddresses.length,
        processingTimeMs: Date.now() - startTime,
      })
      throw error
    }
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
  ): Promise<{ balance: bigint; blockNumber: bigint; blockHash: Hex }> {
    const clientKernel = await this.kernelAccountClientService.getClient(chainID)
    const kernelAddress = clientKernel.kernelAccount?.address
    const eocAddress = clientKernel.account?.address
    const [balance, blockNumber] = await Promise.all([
      (async () => {
        if (eocAddress && kernelAddress) {
          const balance = await clientKernel.getBalance({ address: eocAddress })
          return balance
        }
        return 0n
      })(),
      clientKernel.getBlockNumber(),
    ])

    // Get block information
    const block = await clientKernel.getBlock({ blockNumber })

    return { balance, blockNumber: block.number, blockHash: block.hash }
  }

  /**
   * Fetches native balances for all solver chains in parallel
   * Used by balance tracker service for initialization
   */
  @Cacheable({ bypassArgIndex: 0 })
  async fetchAllNativeBalances(
    forceRefresh = false,
  ): Promise<
    Array<{ chainId: number; balance: bigint; blockNumber: bigint; blockHash: Hex } | null>
  > {
    // Get native balances for all chains
    const chainIds = Object.keys(this.configService.getSolvers()).map(Number)
    const nativeBalancePromises = chainIds.map(async (chainId) => {
      try {
        const nativeBalanceData = await this.fetchNativeBalance(chainId, forceRefresh)
        return {
          chainId,
          balance: nativeBalanceData.balance,
          blockNumber: nativeBalanceData.blockNumber,
          blockHash: nativeBalanceData.blockHash,
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

    // Fetch both token data and block information in parallel
    const [multicallResults, blockNumber] = await Promise.all([
      client.multicall({
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
      }) as Promise<MulticallReturnType>,
      client.getBlockNumber(),
    ])

    // Get block information
    const block = await client.getBlock({ blockNumber })

    const tokenBalances: Record<Hex, TokenBalance> = {}

    for (let index = 0; index < tokenAddresses.length; index++) {
      const tokenAddress = tokenAddresses[index]
      const [balance = 0n, decimals = 0] = [
        multicallResults[index * 2],
        multicallResults[index * 2 + 1],
      ]
      //skip tokens that don't have 6 decimals - log warning but don't break the entire operation
      //audit conversion of validity to see its support
      if ((decimals as number) != 6) {
        this.logger.warn(
          EcoLogMessage.fromDefault({
            message: `Skipping token with invalid decimals`,
            properties: {
              chainID,
              tokenAddress,
              decimals: decimals as number,
              expectedDecimals: 6,
            },
          }),
        )
        continue // Skip this token but continue with others
      }
      tokenBalances[tokenAddress] = {
        address: tokenAddress,
        balance: balance as bigint,
        decimals: decimals as number,
        blockNumber: block.number,
        blockHash: block.hash,
      }
    }
    return tokenBalances
  }

  @Cacheable({ bypassArgIndex: 2 })
  async fetchTokenBalance(
    chainID: number,
    tokenAddress: Hex,
    //used by cacheable decorator
    forceRefresh = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<TokenBalance> {
    const result = await this.fetchTokenBalances(chainID, [tokenAddress], forceRefresh)
    return result[tokenAddress]
  }

  @Cacheable({ bypassArgIndex: 1 })
  async fetchTokenBalancesForChain(
    chainID: number,
    //used by cacheable decorator
    forceRefresh = false, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<Record<Hex, TokenBalance> | undefined> {
    const intentSource = this.configService.getIntentSource(chainID)
    if (!intentSource) {
      return undefined
    }
    return this.fetchTokenBalances(chainID, intentSource.tokens, forceRefresh)
  }

  @Cacheable()
  async fetchTokenData(chainID: number): Promise<TokenFetchAnalysis[]> {
    const tokenConfigs = groupBy(this.configService.getInboxTokens(), 'chainId')[chainID]
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
    const tokens = this.configService.getInboxTokens()
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

      // Only include configs for tokens that were successfully fetched
      const results: Array<{
        config: TokenConfig
        balance: TokenBalance
        chainId: number
      }> = []
      for (const config of configs) {
        const balance = balances[config.address]
        if (balance) {
          results.push({
            config,
            balance,
            chainId: parseInt(chainId),
          })
        }
      }
      return results
    })

    return Promise.all(balancesPerChainIdPromise).then((result) => result.flat())
  }

  /**
   * Gets the native token balance (ETH, MATIC, etc.) for the solver's EOA wallet on the specified chain.
   * This is used to check if the solver has sufficient native funds to cover gas costs and native value transfers.
   *
   * @param chainID - The chain ID to check the native balance on
   * @returns The native token balance in wei (base units), or 0n if no EOA address is found
   */
  @Cacheable()
  async getNativeBalance(chainID: number, account: 'kernel' | 'eoc'): Promise<bigint> {
    const client = await this.kernelAccountClientService.getClient(chainID)
    const address = account == 'eoc' ? client.account?.address : client.kernelAccount.address
    if (!address) {
      return 0n
    }
    return await client.getBalance({ address })
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
